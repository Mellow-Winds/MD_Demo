const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

const MAX_COURSES_PER_IMPORT = 50;
const MAX_COURSES_PER_USER = 50;

// ===== 学期阶段判断 =====
// 返回 { period: 'first'|'second'|'summer'|'closed', label: string }
function getCurrentPeriod() {
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();

  // 1.2 - 2.14: 寒假，禁止导入
  if ((m === 1 && d >= 2) || (m === 2 && d <= 14)) {
    return { period: 'closed', label: '寒假期间，暂不支持导入课程' };
  }
  // 2.15 - 6.14: 第二学期
  if ((m === 2 && d >= 15) || (m >= 3 && m <= 5) || (m === 6 && d <= 14)) {
    return { period: 'second', label: '第二学期' };
  }
  // 6.15 - 8.14: 暑期
  if ((m === 6 && d >= 15) || m === 7 || (m === 8 && d <= 14)) {
    return { period: 'summer', label: '暑期' };
  }
  // 8.15 - 12.31: 第一学期
  if ((m === 8 && d >= 15) || m >= 9) {
    return { period: 'first', label: '第一学期' };
  }
  // 1.1: 第一学期末
  if (m === 1 && d === 1) {
    return { period: 'first', label: '第一学期' };
  }
  return { period: 'closed', label: '非开放导入时段' };
}

// 生成当前学期标识（用于数据库记录）
function getSemesterKey() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();

  if ((m === 8 && d >= 15) || m >= 9 || (m === 1 && d === 1)) {
    return `${y}-1`; // 第一学期
  }
  if ((m === 2 && d >= 15) || (m >= 3 && m <= 5) || (m === 6 && d <= 14)) {
    return `${y}-2`; // 第二学期
  }
  if ((m === 6 && d >= 15) || m === 7 || (m === 8 && d <= 14)) {
    return `${y}-summer`; // 暑期
  }
  return `${y}-closed`;
}

function findExistingCourse(db, course) {
  return db.get(
    'SELECT id FROM courses WHERE description LIKE ? AND title = ? AND teacher = ?',
    [`${course.courseId} · %`, course.className, course.teacher]
  );
}

function cleanBigCourseName(title) {
  if (!title) return '';
  const parens = title.match(/[（(].+?[)）]/g) || [];
  let temp = title;
  parens.forEach((p, i) => { temp = temp.replace(p, `__PH${i}__`); });
  temp = temp.replace(/\d{1,3}\s*班\s*$/, '');
  temp = temp.replace(/[\s ]*\d{1,3}\s*$/, '');
  temp = temp.replace(/\d{1,3}$/, '');
  parens.forEach((p, i) => { temp = temp.replace(`__PH${i}__`, p); });
  return temp.trim();
}

function findOrCreateBigCourse(db, title, userId) {
  const bigName = cleanBigCourseName(title);
  if (!bigName || bigName === title) return null;
  let big = db.get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL AND (description = "" OR description IS NULL)', [bigName]);
  if (!big) {
    db.run('INSERT INTO courses (title, description, owner_id, teacher) VALUES (?, "", ?, "")', [bigName, userId || 0]);
    big = db.get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL AND (description = "" OR description IS NULL)', [bigName]);
  }
  return big ? big.id : null;
}

module.exports = function (db) {
  const router = express.Router();

  // GET /api/schedule/notes
  router.get('/notes', (req, res) => {
    const notesPath = path.join(__dirname, '..', 'data', 'schedule', 'notes.md');
    if (!fs.existsSync(notesPath)) return res.json({ content: '' });
    res.json({ content: fs.readFileSync(notesPath, 'utf-8') });
  });

  // GET /api/schedule/pre-notes
  router.get('/pre-notes', (req, res) => {
    const filePath = path.join(__dirname, '..', 'data', 'schedule', 'pre-notes.md');
    if (!fs.existsSync(filePath)) return res.json({ content: '' });
    res.json({ content: fs.readFileSync(filePath, 'utf-8') });
  });

  // POST /api/schedule/import [Auth]
  router.post('/import', authMiddleware, upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const userId = req.user.userId;
    const semesterKey = getSemesterKey();

    // --- 学期阶段检查 ---
    const period = getCurrentPeriod();
    if (period.period === 'closed') {
      return res.status(403).json({ error: period.label });
    }

    // --- 本学期是否已导入 ---
    const alreadyImported = db.get(
      'SELECT id FROM user_courses WHERE user_id = ? AND semester_key = ? LIMIT 1',
      [userId, semesterKey]
    );
    if (alreadyImported) {
      return res.status(429).json({
        error: `本学期（${period.label}）已经导入过课程，每学期仅允许导入一次`
      });
    }

    // --- 当前用户本学期课程数检查 ---
    const courseCount = db.get(
      'SELECT COUNT(*) AS cnt FROM user_courses WHERE user_id = ? AND semester_key = ?',
      [userId, semesterKey]
    );
    if (courseCount.cnt >= MAX_COURSES_PER_USER) {
      return res.status(400).json({
        error: `本学期课程数已达 ${MAX_COURSES_PER_USER} 门上限，请先退出部分课程后再导入`
      });
    }

    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const parsed = parseSchedule(data);

      if (parsed.length > MAX_COURSES_PER_IMPORT) {
        return res.status(400).json({
          error: `单次导入上限 ${MAX_COURSES_PER_IMPORT} 门，当前解析到 ${parsed.length} 门`
        });
      }

      if (parsed.length === 0) {
        return res.status(400).json({ error: '未解析到任何课程，请检查文件格式' });
      }

      // 检查导入后是否超限
      const remaining = MAX_COURSES_PER_USER - courseCount.cnt;
      if (parsed.length > remaining) {
        return res.status(400).json({
          error: `你还可以添加 ${remaining} 门课程，本次导入 ${parsed.length} 门，超出上限`
        });
      }

      // --- 写入数据库 ---
      // 注意：sql.js 的 db.run('BEGIN') 是 no-op，需要通过 db.db.run('BEGIN') 操作底层对象
      let importedCount = 0;

      try {
        db.db.run('BEGIN');
        for (const c of parsed) {
          const existing = findExistingCourse(db, c);

          let courseId;
          if (existing) {
            courseId = existing.id;
            // 回填 semester（如果为空）
            db.run('UPDATE courses SET semester = ? WHERE id = ? AND (semester = "" OR semester IS NULL)', [semesterKey, courseId]);
          } else {
            const desc = [c.courseId, c.time, c.location].filter(Boolean).join(' · ');
            const result = db.run(
              'INSERT INTO courses (title, description, teacher, owner_id, semester) VALUES (?, ?, ?, ?, ?)',
              [c.className, desc, c.teacher, userId, semesterKey]
            );
            courseId = result.lastInsertRowid;
          }

          // 设置 big_course_id
          const bigId = findOrCreateBigCourse(db, c.className, userId);
          if (bigId) {
            db.run('UPDATE courses SET big_course_id = ? WHERE id = ? AND (big_course_id IS NULL OR big_course_id = 0)', [bigId, courseId]);
          }

          const enrolled = db.get(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
          );
          if (!enrolled) {
            db.run(
              'INSERT INTO user_courses (user_id, course_id, semester_key) VALUES (?, ?, ?)',
              [userId, courseId, semesterKey]
            );
            importedCount++;
          }
        }
        db.db.run('COMMIT');
        db.save();
      } catch (dbErr) {
        try { db.db.run('ROLLBACK'); } catch { /* ignore rollback error */ }
        throw dbErr;
      }

      const courses = db.all(`
        SELECT DISTINCT c.*,
          (SELECT COUNT(*) FROM user_courses uc2 WHERE uc2.course_id = c.id) AS enrollment_count
        FROM courses c
        JOIN user_courses uc ON uc.course_id = c.id
        WHERE uc.user_id = ?
        ORDER BY c.created_at DESC
      `, [userId]);
      res.json({ courses, imported: importedCount });
    } catch (err) {
      console.error('解析课表失败:', err);
      res.status(500).json({ error: '解析课表失败，请检查文件格式' });
    }
  });

  // GET /api/schedule/available - 搜索可选课程
  router.get('/available', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { courseId, name, day, teacher, year, semester } = req.query;

    let sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count,
        (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id AND uc.user_id = ?) AS is_enrolled
      FROM courses c
      WHERE c.description IS NOT NULL AND c.description != ""
    `;
    const params = [userId];

    if (courseId) {
      sql += ' AND c.description LIKE ?';
      params.push(`%${courseId}%`);
    }
    if (name) {
      sql += ' AND c.title LIKE ?';
      params.push(`%${name}%`);
    }
    if (teacher) {
      sql += ' AND c.teacher LIKE ?';
      params.push(`%${teacher}%`);
    }
    if (day) {
      sql += ' AND c.description LIKE ?';
      params.push(`%${day}%`);
    }
    if (semester) {
      sql += ' AND c.semester = ?';
      params.push(semester);
    } else if (year) {
      sql += ' AND c.semester LIKE ?';
      params.push(`${year}-%`);
    }

    sql += ' ORDER BY c.created_at DESC LIMIT 100';

    const courses = db.all(sql, params);
    res.json(courses);
  });

  return router;
};

module.exports.findExistingCourse = findExistingCourse;

// ===== 解析引擎 =====

function parseSchedule(data) {
  const courseMap = new Map();
  const courseRows = [6, 9, 12, 15, 18, 21];

  for (const rowIdx of courseRows) {
    if (rowIdx >= data.length) continue;
    const row = data[rowIdx];

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const colStart = 1 + dayIdx * 3;
      for (let colOff = 0; colOff < 3; colOff++) {
        const colIdx = colStart + colOff;
        if (colIdx >= row.length) continue;

        const cellValue = String(row[colIdx] || '').trim();
        if (!cellValue) continue;

        const parsed = parseCourseCell(cellValue);
        if (parsed) {
          const key = parsed.courseId + '|' + parsed.className;
          if (!courseMap.has(key)) {
            courseMap.set(key, parsed);
          }
        }
      }
    }
  }

  return Array.from(courseMap.values());
}

function parseCourseCell(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const firstLine = lines[0];
  const idMatch = firstLine.match(/^(\S+)\s+(.+)$/);
  if (!idMatch) return null;

  return {
    courseId: idMatch[1],
    className: idMatch[2],
    teacher: lines[1],
    time: lines[2],
    location: lines.length >= 4 ? lines[3] : ''
  };
}
