import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createFavoritesRouter from '../routes/favorites.js';
import { generateToken } from '../routes/middleware/auth.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, nickname TEXT);
    CREATE TABLE courses (
      id INTEGER PRIMARY KEY, title TEXT, teacher TEXT, description TEXT,
      semester TEXT, created_at TEXT
    );
    CREATE TABLE user_courses (id INTEGER PRIMARY KEY, user_id INTEGER, course_id INTEGER);
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY, course_id INTEGER, author_id INTEGER,
      title TEXT, content TEXT, created_at TEXT
    );
    CREATE TABLE favorite_courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, course_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, course_id)
    );
    CREATE TABLE favorite_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, post_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );
    INSERT INTO users VALUES (1, 'u1', '小林');
    INSERT INTO courses VALUES (10, '线性代数', '张老师', '', '2026春', '2026-06-01');
    INSERT INTO courses VALUES (11, '高等数学', '李老师', '', '2026春', '2026-06-02');
    INSERT INTO user_courses VALUES (1, 1, 10);
    INSERT INTO posts VALUES (20, 10, 1, '矩阵求逆', '分享一种做法', '2026-06-02');
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

function call(router, method, path, params = {}, query = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  let statusCode = 200;
  let body;
  const req = {
    params,
    query,
    headers: { authorization: `Bearer ${generateToken({ id: 1, username: 'u1' })}` },
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; },
  };
  let index = 0;
  const next = () => layer.route.stack[index++]?.handle(req, res, next);
  next();
  return { statusCode, body };
}

const SQL = await initSqlJs();

test('course favorites are idempotent and can be removed', () => {
  const router = createFavoritesRouter(createDb(SQL));
  assert.equal(call(router, 'post', '/courses/:courseId', { courseId: '10' }).statusCode, 201);
  assert.equal(call(router, 'post', '/courses/:courseId', { courseId: '10' }).statusCode, 200);
  assert.equal(call(router, 'get', '/', {}, { type: 'courses' }).body.length, 1);
  assert.equal(call(router, 'delete', '/courses/:courseId', { courseId: '10' }).statusCode, 200);
  assert.equal(call(router, 'get', '/', {}, { type: 'courses' }).body.length, 0);
});

test('post favorites return course and author details', () => {
  const router = createFavoritesRouter(createDb(SQL));
  assert.equal(call(router, 'post', '/posts/:postId', { postId: '20' }).statusCode, 201);
  const posts = call(router, 'get', '/', {}, { type: 'posts' }).body;
  assert.equal(posts[0].course_title, '线性代数');
  assert.equal(posts[0].author_name, '小林');
  assert.equal(call(router, 'delete', '/posts/:postId', { postId: '20' }).statusCode, 200);
});

test('favorite lists return newest items first', () => {
  const db = createDb(SQL);
  const router = createFavoritesRouter(db);
  call(router, 'post', '/courses/:courseId', { courseId: '10' });
  db.run("UPDATE favorite_courses SET created_at = '2026-06-01' WHERE course_id = 10");
  call(router, 'post', '/courses/:courseId', { courseId: '11' });
  assert.deepEqual(call(router, 'get', '/', {}, { type: 'courses' }).body.map(item => item.id), [11, 10]);
});

test('favorite endpoints reject missing resources', () => {
  const router = createFavoritesRouter(createDb(SQL));
  assert.equal(call(router, 'post', '/courses/:courseId', { courseId: '999' }).statusCode, 404);
  assert.equal(call(router, 'post', '/posts/:postId', { postId: '999' }).statusCode, 404);
});
