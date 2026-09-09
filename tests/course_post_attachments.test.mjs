import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import express from 'express';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createCoursesRouter from '../routes/courses.js';
import { generateToken } from '../routes/middleware/auth.js';

const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'post-attachments');

async function listUploads() {
  return new Set(await readdir(uploadDir).catch(() => []));
}

const initialUploads = await listUploads();

after(async () => {
  for (const fileName of await listUploads()) {
    if (!initialUploads.has(fileName)) await unlink(path.join(uploadDir, fileName));
  }
});

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, nickname TEXT);
    CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT, description TEXT DEFAULT '', big_course_id INTEGER);
    CREATE TABLE user_courses (id INTEGER PRIMARY KEY, user_id INTEGER, course_id INTEGER);
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER, author_id INTEGER,
      title TEXT, content TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE comments (id INTEGER PRIMARY KEY, post_id INTEGER);
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT,
      message TEXT, related_type TEXT, related_id INTEGER, course_id INTEGER
    );
    CREATE TABLE post_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, file_path TEXT,
      file_name TEXT, file_type TEXT, file_size INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users VALUES (1, 'u1', '小林');
    INSERT INTO users VALUES (2, 'u2', '小周');
    INSERT INTO courses (id, title, description, big_course_id) VALUES (10, '线性代数', '', NULL);
    INSERT INTO user_courses VALUES (1, 1, 10);
  `);
  return {
    run(sql, params = []) {
      raw.run(sql, params);
      const row = raw.exec('SELECT last_insert_rowid() AS id')[0];
      return { lastInsertRowid: row.values[0][0], changes: raw.getRowsModified() };
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

async function withServer(db, run) {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', createCoursesRouter(db));
  app.use((err, req, res, next) => res.status(400).json({ error: err.message }));
  const server = app.listen(0);
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

const SQL = await initSqlJs();
const token = generateToken({ id: 1, username: 'u1' });
const headers = { Authorization: `Bearer ${token}` };
const outsiderHeaders = { Authorization: `Bearer ${generateToken({ id: 2, username: 'u2' })}` };

test('course posts still accept JSON requests', async () => {
  await withServer(createDb(SQL), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/courses/10/posts`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '纯文本', content: '内容' }),
    });
    assert.equal(response.status, 201);
  });
});

test('users outside a course cannot publish posts into it', async () => {
  await withServer(createDb(SQL), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/courses/10/posts`, {
      method: 'POST',
      headers: { ...outsiderHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '越权发帖', content: '内容' }),
    });
    assert.equal(response.status, 403);
  });
});

test('course posts accept multiple multipart attachments and expose URLs', async () => {
  await withServer(createDb(SQL), async (baseUrl) => {
    const body = new FormData();
    body.append('title', '附件帖子');
    body.append('content', '正文');
    body.append('files', new Blob(['image'], { type: 'image/png' }), 'preview.png');
    body.append('files', new Blob(['notes'], { type: 'text/plain' }), 'notes.txt');
    const response = await fetch(`${baseUrl}/api/courses/10/posts`, { method: 'POST', headers, body });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.attachments.length, 2);
    assert.match(result.attachments[0].view_url, /\/view$/);
    assert.match(result.attachments[1].download_url, /\/download$/);
  });
});

test('course posts reject more than nine attachments', async () => {
  await withServer(createDb(SQL), async (baseUrl) => {
    const body = new FormData();
    body.append('title', '太多附件');
    body.append('content', '正文');
    for (let index = 0; index < 10; index++) {
      body.append('files', new Blob([String(index)]), `${index}.txt`);
    }
    const response = await fetch(`${baseUrl}/api/courses/10/posts`, { method: 'POST', headers, body });
    assert.equal(response.status, 400);
  });
});
