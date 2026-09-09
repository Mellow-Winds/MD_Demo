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
    CREATE TABLE follows (id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER, following_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(follower_id, following_id));
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT,
      message TEXT, related_type TEXT, related_id INTEGER, course_id INTEGER,
      is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE materials (id INTEGER PRIMARY KEY, course_id INTEGER, uploader_id INTEGER, title TEXT, description TEXT, created_at TEXT);
    CREATE TABLE study_invites (id INTEGER PRIMARY KEY, creator_id INTEGER, course_id INTEGER, title TEXT, description TEXT, status TEXT, study_date TEXT, created_at TEXT);
    CREATE TABLE square_posts (id INTEGER PRIMARY KEY, creator_id INTEGER, title TEXT, category TEXT, description TEXT, status TEXT, expires_at TEXT, created_at TEXT);
    CREATE TABLE contact_exchange_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      message TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );
    INSERT INTO contact_exchange_requests (from_user_id, to_user_id, message, status) VALUES (2, 1, '历史请求', 'accepted');
    INSERT INTO users VALUES (1, 'u1', '请求方', '数学', '2024', '', '', '', '', '111', 'wx1', '', 1, 1, 1, '2026-06-01');
    INSERT INTO users VALUES (2, 'u2', '接收方', '物理', '2023', '', '', '', '', '222', 'wx2', '', 1, 1, 1, '2026-06-01');
    INSERT INTO users VALUES (3, 'u3', 'target', 'CS', '2025', '', '', '', '', '333', 'wx3', '', 1, 1, 1, '2026-06-01');
  `);
  return {
    run(sql, params = []) {
      raw.run(sql, params);
      const id = raw.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0];
      return { lastInsertRowid: id, changes: raw.getRowsModified() };
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

async function call(router, method, path, { params = {}, userId, body = {}, query = {} } = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  if (!layer) return { statusCode: 404, body: { error: 'not found' } };
  let statusCode = 200;
  let responseBody;
  const req = {
    params,
    query,
    body,
    headers: { authorization: `Bearer ${generateToken({ id: userId, username: `u${userId}` })}` },
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; },
  };
  let index = 0;
  const next = () => layer.route.stack[index++]?.handle(req, res, next);
  await next();
  return { statusCode, body: responseBody };
}

const SQL = await initSqlJs();

test('contact exchange request notification points to the request id', async () => {
  const db = createDb(SQL);
  const router = createUserRouter(db);

  const result = await call(router, 'post', '/:id/contact-exchange', {
    params: { id: '3' },
    userId: 1,
    body: { message: '一起交流课程资料' },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'pending');
  assert.ok(result.body.requestId);
  const request = db.get('SELECT * FROM contact_exchange_requests WHERE from_user_id = 1 AND to_user_id = 3');
  const notification = db.get('SELECT * FROM notifications WHERE user_id = 3');
  assert.equal(notification.related_type, 'contact_exchange');
  assert.notEqual(request.id, 1);
  assert.equal(notification.related_id, request.id);
});

test('accepted contact exchange is reused instead of creating another request', async () => {
  const db = createDb(SQL);
  const router = createUserRouter(db);

  const result = await call(router, 'post', '/:id/contact-exchange', {
    params: { id: '2' },
    userId: 1,
    body: { message: 'again' },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.alreadyAccepted, true);
  assert.equal(result.body.status, 'accepted');
  assert.equal(result.body.requestId, 1);
  const count = db.get('SELECT COUNT(*) AS count FROM contact_exchange_requests WHERE from_user_id = 1 AND to_user_id = 2');
  assert.equal(count.count, 0);
});

test('accepted contact exchange detail shows the other user and contact info for both sides', async () => {
  const db = createDb(SQL);
  const router = createUserRouter(db);

  const requesterView = await call(router, 'get', '/contact-exchange/:id', {
    params: { id: '1' },
    userId: 1,
  });
  assert.equal(requesterView.statusCode, 200);
  assert.equal(requesterView.body.otherUser.id, 2);
  assert.equal(requesterView.body.contactInfo.qq, '222');

  const recipientView = await call(router, 'get', '/contact-exchange/:id', {
    params: { id: '1' },
    userId: 2,
  });
  assert.equal(recipientView.statusCode, 200);
  assert.equal(recipientView.body.otherUser.id, 1);
  assert.equal(recipientView.body.contactInfo.qq, '111');
});
