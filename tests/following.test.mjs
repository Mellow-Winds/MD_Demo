import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createUserRouter from '../routes/user.js';
import { generateToken } from '../routes/middleware/auth.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, username TEXT, nickname TEXT, major TEXT, grade TEXT,
      avatar_url TEXT, avatar_desc TEXT, mbti TEXT, gender TEXT, qq TEXT, wechat TEXT, douyin TEXT,
      privacy_show_profile INTEGER, privacy_show_following INTEGER, privacy_show_followers INTEGER,
      created_at TEXT
    );
    CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT, teacher TEXT);
    CREATE TABLE user_courses (id INTEGER PRIMARY KEY, user_id INTEGER, course_id INTEGER);
    CREATE TABLE follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER, following_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(follower_id, following_id)
    );
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT,
      message TEXT, related_type TEXT, related_id INTEGER, course_id INTEGER,
      is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE materials (
      id INTEGER PRIMARY KEY, course_id INTEGER, uploader_id INTEGER, title TEXT,
      description TEXT, created_at TEXT
    );
    CREATE TABLE study_invites (
      id INTEGER PRIMARY KEY, creator_id INTEGER, course_id INTEGER, title TEXT,
      description TEXT, status TEXT, study_date TEXT, created_at TEXT
    );
    CREATE TABLE square_posts (
      id INTEGER PRIMARY KEY, creator_id INTEGER, title TEXT, category TEXT,
      description TEXT, status TEXT, expires_at TEXT, created_at TEXT
    );
    INSERT INTO users VALUES (1, 'u1@example.com', '小林', '数学', '2024', '', '', '', '', '', '', '', 1, 1, 1, '2026-06-01');
    INSERT INTO users VALUES (2, 'u2@example.com', '隐私用户', '物理', '2023', '', '', '', '', '123', '', '', 0, 1, 1, '2026-06-01');
    INSERT INTO users VALUES (3, 'u3@example.com', '公开用户', '数学', '2024', '', '', '', '', '', '', '', 1, 1, 1, '2026-06-01');
    INSERT INTO courses VALUES (10, '线性代数', '张老师');
    INSERT INTO user_courses VALUES (1, 1, 10);
    INSERT INTO user_courses VALUES (2, 3, 10);
    INSERT INTO follows (follower_id, following_id) VALUES (1, 3);
    INSERT INTO materials VALUES (20, 10, 3, '期末复习', '复习提纲', '2026-06-02 08:00:00');
    INSERT INTO study_invites VALUES (30, 3, 10, '图书馆自习', '下午复习', 'open', '2099-06-03', '2026-06-02 09:00:00');
    INSERT INTO square_posts VALUES (40, 3, '寻找项目搭子', '项目组队', '一起做项目', 'open', '2099-06-09', '2026-06-02 10:00:00');
  `);
  return {
    run(sql, params = []) {
      raw.run(sql, params);
      return { changes: raw.getRowsModified() };
    },
    get(sql, params = []) {
      const stmt = raw.prepare(sql);
      stmt.bind(params);
      const value = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return value;
    },
    all(sql, params = []) {
      const stmt = raw.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    save() {},
  };
}

function call(router, method, path, { params = {}, query = {}, userId, body = {} } = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  let statusCode = 200;
  let responseBody;
  const headers = userId
    ? { authorization: `Bearer ${generateToken({ id: userId, username: `u${userId}` })}` }
    : {};
  const req = { params, query, body, headers };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; },
  };
  let index = 0;
  const next = () => layer.route.stack[index++]?.handle(req, res, next);
  next();
  return { statusCode, body: responseBody };
}

const SQL = await initSqlJs();

test('private profile cannot be unlocked with a forged viewer_id query', () => {
  const router = createUserRouter(createDb(SQL));
  const result = call(router, 'get', '/:id/profile', {
    params: { id: '2' },
    query: { viewer_id: '2' },
  });
  assert.equal(result.body.privacyHidden, true);
  assert.equal(result.body.qq, undefined);
});

test('profile public preview applies non-self privacy filtering to the owner', () => {
  const router = createUserRouter(createDb(SQL));
  const result = call(router, 'get', '/:id/profile', {
    params: { id: '2' },
    query: { preview: 'public' },
    userId: 2,
  });
  assert.equal(result.body.privacyHidden, true);
  assert.equal(result.body.qq, undefined);
});

test('profile public preview does not include self common courses', () => {
  const router = createUserRouter(createDb(SQL));
  const result = call(router, 'get', '/:id/profile', {
    params: { id: '3' },
    query: { preview: 'public' },
    userId: 3,
  });
  assert.deepEqual(result.body.commonCourses, []);
  assert.equal(result.body.isFollowing, false);
});

test('public profile returns shared courses for an authenticated viewer', () => {
  const router = createUserRouter(createDb(SQL));
  const result = call(router, 'get', '/:id/profile', { params: { id: '3' }, userId: 1 });
  assert.deepEqual(result.body.commonCourses, [{ id: 10, title: '线性代数', teacher: '张老师' }]);
  assert.equal(result.body.isFollowing, true);
});

test('following a user creates a notification for that user', () => {
  const db = createDb(SQL);
  const router = createUserRouter(db);
  const result = call(router, 'post', '/:id/follow', { params: { id: '2' }, userId: 1 });
  assert.equal(result.statusCode, 200);
  const notification = db.get('SELECT * FROM notifications WHERE user_id = ?', [2]);
  assert.equal(notification.type, 'new_follower');
  assert.equal(notification.related_type, 'user');
  assert.equal(notification.related_id, 1);
});

test('following feed aggregates materials, invites, and square posts', () => {
  const router = createUserRouter(createDb(SQL));
  const result = call(router, 'get', '/feed', { userId: 1 });
  assert.deepEqual(result.body.activities.map(item => item.activity_type), ['square_post', 'invite', 'material']);
});
