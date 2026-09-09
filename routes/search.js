const express = require('express');

// 大课名称清洗（与前端 plaza.js 一致）
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

module.exports = function (db) {
  const router = express.Router();

  // GET /api/search — 全局搜索
  router.get('/', (req, res) => {
    const { q, type = 'all', page = 1, pageSize = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: '关键词至少 2 个字符' });
    }

    const keyword = `%${q.trim()}%`;
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    const results = {};

    let total = 0;

    if (type === 'all' || type === 'courses') {
      // 只查大课记录，再用清洗逻辑过滤掉漏网的小课
      const bigCourseCond = `c.big_course_id IS NULL AND (c.description = '' OR c.description IS NULL)`;
      const allMatched = db.all(`
        SELECT c.id, c.title, c.teacher, c.semester,
          (SELECT COUNT(*) FROM user_courses uc JOIN courses c2 ON uc.course_id = c2.id WHERE c2.big_course_id = c.id) AS enrollment_count
        FROM courses c
        WHERE (${bigCourseCond}) AND (c.title LIKE ? OR c.teacher LIKE ?)
        ORDER BY c.created_at DESC
      `, [keyword, keyword]);
      // 过滤：清洗后名称与原标题不同的，是漏网的小课，剔除
      const filtered = allMatched.filter(c => cleanBigCourseName(c.title) === c.title);
      total += filtered.length;
      results.courses = filtered.slice(offset, offset + limit);
    }

    if (type === 'all' || type === 'materials') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM materials m WHERE m.title LIKE ? OR m.description LIKE ? OR m.chapter LIKE ?`, [keyword, keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.materials = db.all(`
        SELECT m.id, m.title, m.chapter, m.category, m.course_id, m.created_at,
          c.title AS course_title, u.nickname AS uploader_name
        FROM materials m
        JOIN courses c ON m.course_id = c.id
        JOIN users u ON m.uploader_id = u.id
        WHERE m.title LIKE ? OR m.description LIKE ? OR m.chapter LIKE ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, keyword, limit, offset]);
    }

    if (type === 'all' || type === 'posts') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM posts p WHERE p.title LIKE ? OR p.content LIKE ?`, [keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.posts = db.all(`
        SELECT p.id, p.title, p.content, p.course_id, p.created_at,
          c.title AS course_title, u.nickname AS author_name
        FROM posts p
        JOIN courses c ON p.course_id = c.id
        JOIN users u ON p.author_id = u.id
        WHERE p.title LIKE ? OR p.content LIKE ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, limit, offset]);
    }

    if (type === 'all' || type === 'squarePosts') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM square_posts sp WHERE (sp.title LIKE ? OR sp.description LIKE ?) AND sp.expires_at > datetime('now', '+8 hours') AND sp.status != 'expired'`, [keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.squarePosts = db.all(`
        SELECT sp.id, sp.title, sp.description, sp.category, sp.status,
          sp.max_people, sp.current_count, sp.expires_at, sp.created_at,
          u.nickname AS creator_name
        FROM square_posts sp
        JOIN users u ON sp.creator_id = u.id
        WHERE (sp.title LIKE ? OR sp.description LIKE ?)
          AND sp.expires_at > datetime('now', '+8 hours')
          AND sp.status != 'expired'
        ORDER BY sp.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, limit, offset]);
    }

    if (type === 'all' || type === 'templates') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM card_templates ct WHERE ct.name LIKE ? OR ct.description LIKE ?`, [keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.templates = db.all(`
        SELECT ct.id, ct.name, ct.description, ct.icon, ct.category,
          ct.styles, ct.is_official, ct.usage_count, ct.created_at,
          u.nickname AS creator_name
        FROM card_templates ct
        LEFT JOIN users u ON ct.creator_id = u.id
        WHERE ct.name LIKE ? OR ct.description LIKE ?
        ORDER BY ct.is_official DESC, ct.usage_count DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, limit, offset]);
    }
    res.json({ ...results, total, q: q.trim() });
  });

  return router;
};
