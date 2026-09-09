import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createExploreCommentsRouter from '../routes/explore_comments.js';
import { generateToken } from '../routes/middleware/auth.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      nickname TEXT,
      avatar_url TEXT
    );
    CREATE TABLE explore_posts (
      id INTEGER PRIMARY KEY,
      creator_id INTEGER,
      title TEXT
    );
    CREATE TABLE explore_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_id INTEGER,
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE notifications (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO users VALUES (1, 'alice', 'Alice', '');
    INSERT INTO users VALUES (2, 'bob', 'Bob', '');
    INSERT INTO explore_posts VALUES (10, 2, 'Post');
    INSERT INTO explore_comments (id, post_id, author_id, content) VALUES (20, 10, 2, 'Parent');
  `);

  return {
    run(sql, params = []) {
      raw.run(sql, params);
      return { changes: raw.getRowsModified(), lastInsertRowid: Number(raw.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]) };
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

function call(router, method, path, params = {}, body = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  let statusCode = 200;
  let responseBody;
  const req = {
    params,
    body,
    headers: { authorization: `Bearer ${generateToken({ id: 1, username: 'alice' })}` },
    is() { return false; },
  };
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

test('explore comment endpoint rejects a second comment during the 30s cooldown', () => {
  const router = createExploreCommentsRouter(createDb(SQL));

  const first = call(router, 'post', '/:postId/comments', { postId: '10' }, { content: 'First' });
  assert.equal(first.statusCode, 201);

  const second = call(router, 'post', '/:postId/comments', { postId: '10' }, { content: 'Second' });
  assert.equal(second.statusCode, 429);
  assert.equal(second.body.retry_after > 0, true);
});

test('reply notifications persist the newly created comment id as an anchor', () => {
  const db = createDb(SQL);
  const router = createExploreCommentsRouter(db);

  const result = call(router, 'post', '/:postId/comments', { postId: '10' }, { content: 'Reply', parent_id: '20' });
  assert.equal(result.statusCode, 201);

  const notification = db.get('SELECT related_id, related_comment_id FROM notifications WHERE user_id = 2');
  assert.equal(notification.related_id, 10);
  assert.equal(notification.related_comment_id, result.body.id);
});
