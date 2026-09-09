import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import initSqlJs from 'sql.js';
import createAuthRouter from '../routes/auth.js';

process.env.NODE_ENV = 'test';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      display_name TEXT,
      email TEXT,
      password_hash TEXT,
      nickname TEXT,
      email_verified INTEGER DEFAULT 1
    );
    CREATE TABLE email_verifications (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
  `);
  raw.run(
    'INSERT INTO users (username, display_name, email, password_hash, nickname, email_verified) VALUES (?, ?, ?, ?, ?, 1)',
    ['123456789@smail.nju.edu.cn', '测试用户', '123456789@smail.nju.edu.cn', bcrypt.hashSync('OldPass123', 4), '测试用户'],
  );
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

async function call(router, method, path, { body = {} } = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  if (!layer) return { statusCode: 404, body: { error: 'not found' } };
  let statusCode = 200;
  let responseBody;
  const req = { body, headers: {}, ip: '127.0.0.1', connection: {} };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; },
  };
  const maybePromise = layer.route.stack[0].handle(req, res, () => {});
  if (maybePromise?.then) await maybePromise;
  return { statusCode, body: responseBody };
}

const SQL = await initSqlJs();

test('password reset request creates a verification code for an existing student account', async () => {
  const db = createDb(SQL);
  const router = createAuthRouter(db);

  const result = await call(router, 'post', '/forgot-password', {
    body: { studentId: '123456789' },
  });

  assert.equal(result.statusCode, 200);
  const record = db.get('SELECT * FROM email_verifications WHERE email = ?', ['123456789@smail.nju.edu.cn']);
  assert.equal(record.code.length, 6);
});

test('password reset with a valid code replaces the password hash', async () => {
  const db = createDb(SQL);
  const router = createAuthRouter(db);
  db.run(
    "INSERT INTO email_verifications (email, code, attempts, expires_at) VALUES (?, ?, 0, datetime('now', '+5 minutes'))",
    ['123456789@smail.nju.edu.cn', '123456'],
  );

  const result = await call(router, 'post', '/reset-password', {
    body: { studentId: '123456789', code: '123456', password: 'NewPass123', confirmPassword: 'NewPass123' },
  });

  assert.equal(result.statusCode, 200);
  const user = db.get('SELECT password_hash FROM users WHERE email = ?', ['123456789@smail.nju.edu.cn']);
  assert.equal(bcrypt.compareSync('NewPass123', user.password_hash), true);
  assert.equal(bcrypt.compareSync('OldPass123', user.password_hash), false);
});
