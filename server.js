require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'eduspace.db');

// --- Database Wrapper ---
class Database {
  constructor(sqlDb) {
    this.db = sqlDb;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    const id = this.db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0];
    const changes = this.db.getRowsModified();
    return { lastInsertRowid: id, changes };
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(sql, params = []) {
    const results = this.db.exec(sql, params);
    if (results.length === 0) return [];
    return results[0].values.map(row => {
      const obj = {};
      results[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  save() {
    const data = this.db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// --- Init ---
async function start() {
  const SQL = await initSqlJs({
    // 显式指定 WASM 文件路径，防止生产环境中找不到 WASM 文件
    locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  fs.mkdirSync(path.join(__dirname, 'db'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'uploads', 'materials'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'uploads', 'comment-images'), { recursive: true });

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  const db = new Database(sqlDb);

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // --- Migration: add new columns (safe if already exist) ---
  const migrateTable = (table, col, type) => {
    const info = db.all(`PRAGMA table_info(${table})`);
    if (!info.some(c => c.name === col)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      console.log(`  ✓ 迁移: ${table}.${col} (${type})`);
    }
  };

  migrateTable('users', 'password_hash', "TEXT DEFAULT ''");
  migrateTable('users', 'nickname', "TEXT DEFAULT ''");
  migrateTable('users', 'major', "TEXT DEFAULT ''");
  migrateTable('users', 'grade', "TEXT DEFAULT ''");
  migrateTable('users', 'email', "TEXT DEFAULT ''");
  migrateTable('users', 'email_verified', "INTEGER DEFAULT 0");
  migrateTable('users', 'verification_code', "TEXT DEFAULT ''");
  migrateTable('users', 'verification_code_expires', "TEXT DEFAULT ''");
  migrateTable('users', 'qq', "TEXT DEFAULT ''");
  migrateTable('users', 'privacy_show_profile', "INTEGER DEFAULT 1");
  migrateTable('users', 'privacy_allow_match', "INTEGER DEFAULT 1");
  migrateTable('users', 'wechat', "TEXT DEFAULT ''");
  migrateTable('users', 'douyin', "TEXT DEFAULT ''");
  migrateTable('users', 'avatar_desc', "TEXT DEFAULT ''");
  migrateTable('users', 'mbti', "TEXT DEFAULT ''");
  migrateTable('users', 'checkin_streak', "INTEGER DEFAULT 0");
  migrateTable('users', 'last_checkin_date', "TEXT DEFAULT ''");
  migrateTable('users', 'grace_days', "INTEGER DEFAULT 0");
  migrateTable('users', 'gender', "TEXT DEFAULT ''");
  migrateTable('users', 'privacy_show_following', "INTEGER DEFAULT 1");
  migrateTable('users', 'privacy_show_followers', "INTEGER DEFAULT 1");
  migrateTable('courses', 'semester', "TEXT DEFAULT ''");
  migrateTable('courses', 'teacher', "TEXT DEFAULT ''");
  migrateTable('courses', 'big_course_id', 'INTEGER');
  migrateTable('comments', 'parent_id', 'INTEGER');
  migrateTable('comments', 'image_url', "TEXT DEFAULT ''");
  migrateTable('comments', 'like_count', "INTEGER DEFAULT 0");
  // square_comments/square_posts migrations moved after table creation

  // New table: user_courses (many-to-many enrollment)
  db.run(`CREATE TABLE IF NOT EXISTS user_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
  )`);

  migrateTable('user_courses', 'semester_key', "TEXT DEFAULT ''");

  // 批量回填小课的 semester 字段（从 user_courses.semester_key 提取）
  db.run(`
    UPDATE courses SET semester = (
      SELECT uc.semester_key FROM user_courses uc
      WHERE uc.course_id = courses.id AND uc.semester_key != ''
      ORDER BY uc.semester_key DESC LIMIT 1
    )
    WHERE big_course_id IS NOT NULL
      AND (semester = '' OR semester IS NULL)
      AND EXISTS (SELECT 1 FROM user_courses uc2 WHERE uc2.course_id = courses.id AND uc2.semester_key != '')
  `);

  // New table: materials (学习资料)
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    uploader_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    chapter TEXT DEFAULT '',
    category TEXT DEFAULT '其他',
    avg_rating REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  )`);

  // New table: material_ratings (资料评分)
  db.run(`CREATE TABLE IF NOT EXISTS material_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(material_id, user_id)
  )`);

  // New table: study_invites (自习邀约)
  db.run(`CREATE TABLE IF NOT EXISTS study_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    course_id INTEGER,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    study_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT DEFAULT '',
    max_participants INTEGER DEFAULT 4,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);
  migrateTable('study_invites', 'approval_required', "INTEGER DEFAULT 0");

  // New table: study_invite_responses (邀约响应)
  db.run(`CREATE TABLE IF NOT EXISTS study_invite_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'accepted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invite_id) REFERENCES study_invites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(invite_id, user_id)
  )`);

  // New table: notifications (消息提醒)
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_type TEXT,
    related_id INTEGER,
    related_comment_id INTEGER,
    course_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // New table: square_posts (交友广场帖子)
  migrateTable('notifications', 'related_comment_id', 'INTEGER');

  db.run(`CREATE TABLE IF NOT EXISTS square_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    max_people INTEGER DEFAULT 1,
    current_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    expires_at TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`);

  // Migrations for square_posts (must be after table creation)
  migrateTable('square_posts', 'course_id', 'INTEGER');
  db.run('CREATE INDEX IF NOT EXISTS idx_square_posts_course_id ON square_posts(course_id)');

  // New table: square_interests (感兴趣记录)
  db.run(`CREATE TABLE IF NOT EXISTS square_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES square_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(post_id, user_id)
  )`);

  // New table: square_comments (广场评论)
  db.run(`CREATE TABLE IF NOT EXISTS square_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES square_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Migrations for square_comments (must be after table creation)
  migrateTable('square_comments', 'parent_id', 'INTEGER');
  migrateTable('square_comments', 'image_url', "TEXT DEFAULT ''");
  migrateTable('square_comments', 'like_count', "INTEGER DEFAULT 0");
  migrateTable('explore_comments', 'like_count', "INTEGER DEFAULT 0");

  // 评论相关索引（try/catch 包裹，兼容 sql.js）
  try { db.run('CREATE INDEX IF NOT EXISTS idx_explore_comments_post ON explore_comments(post_id, parent_id)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_comment_likes_type_cid ON comment_likes(comment_type, comment_id)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_comment_likes_type_user ON comment_likes(comment_type, user_id, comment_id)'); } catch {}

  // New table: follows (关注关系)
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_id, following_id)
  )`);

  // New table: feedback (问题反馈)
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    contact TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // New table: echo_cave_quotes (回声洞语录)
  db.run(`CREATE TABLE IF NOT EXISTS echo_cave_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_id INTEGER,
    source TEXT DEFAULT 'system',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  // Seed: 开发者自建回声洞语录（仅首次插入）
  const echoSeeds = [
    '世界上最遥远的距离，不是生与死，而是你在写作业，我在写另一个作业。',
    '今天也是被DDL追着跑的一天呢。',
    '学习不是为了考试，是为了在考试的时候不那么慌。',
    '你以为的大学：自由、浪漫、探索。实际的大学：签到、作业、绩点。',
    '不要害怕慢，你只是在蓄力。乌龟赢了兔子，你忘了？',
    '今天不想学习？没关系，明天也不会想的。但还是得学。',
    '人生就像一场考试，你永远不知道下一题会考什么。',
    '如果学习让你感到痛苦，说明你正在走上坡路。',
    '每个学霸背后，都有一个默默崩溃然后又默默振作的自己。',
    '你有多努力，就有多幸运。这不是鸡汤，是概率。',
    '休息是为了走更长的路，不是为了让路变短。',
    '成功不是终点，失败也不是末日，重要的是继续前进的勇气。',
    '代码跑通了就是对程序员最好的赞美。',
    '生活不止眼前的bug，还有远方的bug。',
    '你以为你在摸鱼，其实鱼也在摸你。',
    '没有什么是一杯奶茶解决不了的，如果有，那就两杯。',
    '做一个温柔的人，但不要做一个好欺负的人。',
    '这个世界需要你去改变，哪怕只是一点点。',
    '当你在凝视深渊的时候，深渊也在凝视你的ddl。',
    '别看了，快去学习。这条回声来自一个小时前的你。'
  ];
  for (const seed of echoSeeds) {
    db.run('INSERT OR IGNORE INTO echo_cave_quotes (content, source) VALUES (?, ?)', [seed, 'system']);
  }

  db.run(`CREATE TABLE IF NOT EXISTS favorite_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS favorite_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE(user_id, post_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS post_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  )`);

  // New table: contact_exchange_requests (交换联系方式请求)
  db.run(`CREATE TABLE IF NOT EXISTS contact_exchange_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // New table: email_verifications (邮箱验证码临时表)
  db.run(`CREATE TABLE IF NOT EXISTS email_verifications (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  )`);

  // ========== 探索模块：组件化卡片系统 ==========

  // New table: explore_cards (卡片 — components 存 JSON，后端不解析)
  db.run(`CREATE TABLE IF NOT EXISTS explore_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    template_id TEXT,
    components TEXT NOT NULL DEFAULT '[]',
    max_participants INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0,
    approval_required INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    course_id INTEGER,
    expires_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);

  // New table: explore_posts (帖子 — 卡片的容器)
  db.run(`CREATE TABLE IF NOT EXISTS explore_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    content TEXT DEFAULT '',
    status TEXT DEFAULT 'published',
    course_id INTEGER,
    expires_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);

  // New table: explore_post_cards (帖子-卡片关联)
  db.run(`CREATE TABLE IF NOT EXISTS explore_post_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES explore_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES explore_cards(id) ON DELETE CASCADE,
    UNIQUE(post_id, card_id)
  )`);

  // New table: card_participants (参与者/报名)
  db.run(`CREATE TABLE IF NOT EXISTS card_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'accepted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES explore_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(card_id, user_id)
  )`);

  // New table: card_vote_records (投票去重)
  db.run(`CREATE TABLE IF NOT EXISTS card_vote_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    module_index INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    option_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES explore_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(card_id, module_index, user_id, option_id)
  )`);

  // New table: explore_comments (帖子评论)
  db.run(`CREATE TABLE IF NOT EXISTS explore_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    parent_id INTEGER,
    image_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES explore_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // New table: comment_likes (统一评论点赞记录，支持多表)
  // 迁移旧表（如有）
  try {
    const oldTable = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='comment_likes'");
    if (oldTable.length > 0) {
      const info = db.all("PRAGMA table_info(comment_likes)");
      const hasTypeCol = info.some(r => r.name === 'comment_type');
      if (!hasTypeCol) {
        // 重命名旧表，创建新表，迁移数据
        db.run('ALTER TABLE comment_likes RENAME TO comment_likes_old');
        db.run(`CREATE TABLE comment_likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comment_type TEXT NOT NULL DEFAULT 'explore',
          comment_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(comment_type, comment_id, user_id)
        )`);
        // 迁移旧数据
        try {
          db.run(`INSERT OR IGNORE INTO comment_likes (id, comment_type, comment_id, user_id, created_at)
            SELECT id, 'explore', comment_id, user_id, created_at FROM comment_likes_old`);
        } catch (e) {
          console.log('  ⚠ 旧数据迁移跳过:', e.message);
        }
        db.run('DROP TABLE comment_likes_old');
        console.log('  ✓ 重构 comment_likes 表（多类型支持）');
      }
    } else {
      db.run(`CREATE TABLE IF NOT EXISTS comment_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_type TEXT NOT NULL DEFAULT 'explore',
        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_type, comment_id, user_id)
      )`);
    }
  } catch (e) {
    console.log('  ⚠ comment_likes 迁移:', e.message);
  }

  // New table: card_templates (卡片模板)
  db.run(`CREATE TABLE IF NOT EXISTS card_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT DEFAULT 'general',
    components_schema TEXT NOT NULL,
    is_official INTEGER DEFAULT 1,
    creator_id INTEGER,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`);

  // Migration: add styles column (UGC card customization)
  try {
    db.run(`ALTER TABLE card_templates ADD COLUMN styles TEXT DEFAULT '{}'`);
  } catch (e) {
    // column already exists — ignore
  }

  // 预置官方模板数据
  const templates = [
    {
      id: 'book_sale',       styles: { bg: '#FDF6E8', accent: '#E8A838' },
      name: '二手书',        description: '出二手教材/书籍',    icon: 'ri-book-2-line',         category: 'trade',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-book-2-line', label: '书名', value: '' },
        { type: 'price', icon: 'ri-money-cny-circle-line', label: '价格', value: '' },
        { type: 'contact', icon: 'ri-wechat-line', label: '联系方式', value: '' },
        { type: 'link', icon: 'ri-links-line', label: '链接', value: '' },
        { type: 'input', icon: 'ri-chat-check-line', label: '可议价', value: '' }
      ])
    },
    {
      id: 'study_invite',    styles: { bg: '#EBF3FC', accent: '#4A90D9' },
      name: '自习邀约',      description: '组队自习',            icon: 'ri-book-open-line',      category: 'study',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-calendar-line', label: '时间', value: '' },
        { type: 'input', icon: 'ri-map-pin-line', label: '地点', value: '' },
        { type: 'input', icon: 'ri-file-text-line', label: '要求', value: '' },
        { type: 'days_matter', icon: 'ri-calendar-event-line', label: '倒数日', value: '' }
      ])
    },
    {
      id: 'social_buddy',    styles: { bg: '#F3EFFE', accent: '#7B61FF' },
      name: '找搭子',        description: '通用交友/搭伴',      icon: 'ri-team-line',           category: 'social',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-user-line', label: '简介', value: '' },
        { type: 'input', icon: 'ri-focus-3-line', label: '目标', value: '' },
        { type: 'contact', icon: 'ri-wechat-line', label: '联系方式', value: '' }
      ])
    },
    {
      id: 'project_team',    styles: { bg: '#E8F8EF', accent: '#2EAD6B' },
      name: '项目组队',      description: '课程项目/竞赛组队',  icon: 'ri-group-line',          category: 'project',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-lightbulb-line', label: '项目描述', value: '' },
        { type: 'input', icon: 'ri-user-add-line', label: '需要人数', value: '' },
        { type: 'input', icon: 'ri-tools-line', label: '技能要求', value: '' },
        { type: 'days_matter', icon: 'ri-calendar-event-line', label: '截止日期', value: '' }
      ])
    },
    {
      id: 'event_buddy',     styles: { bg: '#FDEEF1', accent: '#E85D75' },
      name: '活动搭子',      description: '演唱会/运动/聚餐等', icon: 'ri-calendar-event-line', category: 'social',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-music-line', label: '活动', value: '' },
        { type: 'input', icon: 'ri-calendar-line', label: '时间', value: '' },
        { type: 'input', icon: 'ri-map-pin-line', label: '地点', value: '' },
        { type: 'price', icon: 'ri-money-cny-circle-line', label: '费用', value: '' }
      ])
    },
    {
      id: 'skill_exchange',  styles: { bg: '#FEF6E7', accent: '#F59E0B' },
      name: '技能交换',      description: '互教互学',            icon: 'ri-exchange-line',       category: 'study',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-book-2-line', label: '我会的', value: '' },
        { type: 'input', icon: 'ri-focus-3-line', label: '想学的', value: '' },
        { type: 'contact', icon: 'ri-wechat-line', label: '联系方式', value: '' }
      ])
    },
    {
      id: 'study_group',     styles: { bg: '#EBF3FC', accent: '#3B82F6' },
      name: '学习小组',      description: '长期学习小组',        icon: 'ri-book-open-line',      category: 'study',
      components_schema: JSON.stringify([
        { type: 'input', icon: 'ri-book-2-line', label: '学习内容', value: '' },
        { type: 'input', icon: 'ri-calendar-line', label: '计划时间', value: '' },
        { type: 'input', icon: 'ri-map-pin-line', label: '地点', value: '' },
        { type: 'input', icon: 'ri-file-text-line', label: '要求', value: '' }
      ])
    }
  ];

  for (const t of templates) {
    db.run(
      `INSERT OR IGNORE INTO card_templates (id, name, description, icon, category, components_schema, is_official, styles)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [t.id, t.name, t.description, t.icon, t.category, t.components_schema, JSON.stringify(t.styles)]
    );
    // Update existing official rows that were seeded before styles column existed
    db.run(
      `UPDATE card_templates SET styles = ? WHERE id = ? AND is_official = 1 AND (styles IS NULL OR styles = '{}')`,
      [JSON.stringify(t.styles), t.id]
    );
  }
  console.log('  ✓ 探索模块表 + 模板数据初始化完成');

  // --- 大课体系数据迁移：为现有小课创建大课记录，迁移内容归属 ---
  {
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

    // 检查是否有小课尚未关联大课
    const unlinked = db.all('SELECT id, title, owner_id FROM courses WHERE big_course_id IS NULL AND description != ""');
    if (unlinked.length > 0) {
      console.log(`  ✓ 大课迁移: 发现 ${unlinked.length} 门小课需要关联大课`);

      // 按大课名分组
      const bigCourseMap = new Map(); // bigName -> { bigCourseId, smallCourseIds: [] }

      for (const small of unlinked) {
        const bigName = cleanBigCourseName(small.title);
        if (!bigName || bigName === small.title) {
          // 无法提取大课名（没有班号），自身即为大课
          continue;
        }
        if (!bigCourseMap.has(bigName)) {
          bigCourseMap.set(bigName, { bigCourseId: null, smallCourseIds: [] });
        }
        bigCourseMap.get(bigName).smallCourseIds.push(small.id);
      }

      // 为每个大课名查找或创建大课记录
      for (const [bigName, info] of bigCourseMap) {
        let big = db.get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL AND description = ""', [bigName]);
        if (!big) {
          const owner = unlinked.find(s => info.smallCourseIds.includes(s.id));
          db.run('INSERT INTO courses (title, description, owner_id, teacher) VALUES (?, "", ?, "")', [bigName, owner ? owner.owner_id : 0]);
          big = db.get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL AND description = ""', [bigName]);
          console.log(`    + 创建大课: ${bigName} (id=${big.id})`);
        }
        info.bigCourseId = big.id;

        // 更新小课的 big_course_id
        for (const smallId of info.smallCourseIds) {
          db.run('UPDATE courses SET big_course_id = ? WHERE id = ?', [info.bigCourseId, smallId]);
        }
      }

      // 迁移 posts/materials/square_posts 的 course_id 到大课
      let migratedPosts = 0, migratedMaterials = 0, migratedSquare = 0;
      for (const [, info] of bigCourseMap) {
        if (info.smallCourseIds.length === 0) continue;
        const placeholders = info.smallCourseIds.map(() => '?').join(',');
        const r1 = db.run(`UPDATE posts SET course_id = ? WHERE course_id IN (${placeholders})`, [info.bigCourseId, ...info.smallCourseIds]);
        migratedPosts += r1.changes || 0;
        const r2 = db.run(`UPDATE materials SET course_id = ? WHERE course_id IN (${placeholders})`, [info.bigCourseId, ...info.smallCourseIds]);
        migratedMaterials += r2.changes || 0;
        const r3 = db.run(`UPDATE square_posts SET course_id = ? WHERE course_id IN (${placeholders})`, [info.bigCourseId, ...info.smallCourseIds]);
        migratedSquare += r3.changes || 0;
      }

      console.log(`  ✓ 大课迁移完成: ${bigCourseMap.size} 个大课, 帖子 ${migratedPosts}, 资料 ${migratedMaterials}, 搭子 ${migratedSquare}`);
    }
  }

  db.save();

  // --- Middleware ---
  // 仅保留必要安全头：COOP + CORP + X-Content-Type + X-Frame + STS + Referrer-Policy
  // 禁用 CSP（与 CDN 资源冲突）、禁用 X-Permitted-Cross-Domain（无 Adobe 需求）
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      xDnsPrefetchControl: false,
      xPermittedCrossDomainPolicies: false,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  // 环境变量注入：将 .env 中前端需要公开的 Key 注入为全局变量
  app.get('/env.js', (req, res) => {
    res.type('application/javascript');
    res.send(`window.ENV = {
  TURNSTILE_SITE_KEY: '${process.env.TURNSTILE_SITE_KEY || ''}'
};`);
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  app.use('/data', express.static(path.join(__dirname, 'data')));

  // --- API Routes ---
  const coursesRouter = require('./routes/courses')(db);
  const userRouter = require('./routes/user')(db);
  const scheduleRouter = require('./routes/schedule')(db);
  const authRouter = require('./routes/auth')(db);
  const materialsRouter = require('./routes/materials')(db);
  const invitesRouter = require('./routes/invites')(db);
  const notificationsRouter = require('./routes/notifications')(db);
  const searchRouter = require('./routes/search')(db);
  const squareRouter = require('./routes/square')(db);
  const myPostsRouter = require('./routes/my_posts')(db);
  const favoritesRouter = require('./routes/favorites')(db);
  const explorePostsRouter = require('./routes/explore_posts')(db);
  const exploreCardsRouter = require('./routes/explore_cards')(db);
  const cardTemplatesRouter = require('./routes/card_templates')(db);
  const exploreCommentsRouter = require('./routes/explore_comments')(db);
  const echoCaveRouter = require('./routes/echo_cave')(db);

  app.use('/api/courses', coursesRouter);
  app.use('/api/materials', materialsRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/square', squareRouter);
  app.use('/api/user', userRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/my-posts', myPostsRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/explore/posts', explorePostsRouter);
  app.use('/api/explore/cards', exploreCardsRouter);
  app.use('/api/card-templates', cardTemplatesRouter);
  app.use('/api/explore/posts', exploreCommentsRouter); // comments nested under posts
  app.use('/api/echo-cave', echoCaveRouter);

  // --- SPA Fallback ---
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // --- Auto-save on shutdown ---
  process.on('SIGINT', () => { db.save(); process.exit(); });
  process.on('SIGTERM', () => { db.save(); process.exit(); });

  app.listen(PORT, () => {
    console.log(`课搭子 server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
