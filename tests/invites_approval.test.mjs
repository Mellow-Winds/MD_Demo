import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createInvitesRouter from '../routes/invites.js';
import { generateToken } from '../routes/middleware/auth.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, nickname TEXT);
    CREATE TABLE study_invites (
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
      approval_required INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE study_invite_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invite_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'accepted',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(invite_id, user_id)
    );
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT,
      message TEXT, related_type TEXT, related_id INTEGER, course_id INTEGER,
      is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users VALUES (1, 'u1', '发起者');
    INSERT INTO users VALUES (2, 'u2', '同学A');
    INSERT INTO users VALUES (3, 'u3', '同学B');
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
  await next();
  return { statusCode, body: responseBody };
}

const SQL = await initSqlJs();

test('invite creation accepts custom participant limit and approval flag', async () => {
  const db = createDb(SQL);
  const router = createInvitesRouter(db);

  const result = await call(router, 'post', '/', {
    userId: 1,
    body: {
      title: '图书馆自习',
      study_date: '2099-06-05',
      start_time: '09:00',
      end_time: '11:00',
      max_participants: 6,
      approval_required: true,
    },
  });

  assert.equal(result.statusCode, 201);
  const invite = db.get('SELECT max_participants, approval_required FROM study_invites WHERE id = ?', [result.body.id]);
  assert.equal(invite.max_participants, 6);
  assert.equal(invite.approval_required, 1);
});

test('approval-required invite stores join response as pending until creator accepts it', async () => {
  const db = createDb(SQL);
  const router = createInvitesRouter(db);
  db.run(`INSERT INTO study_invites
    (id, creator_id, title, study_date, start_time, end_time, max_participants, approval_required, status)
    VALUES (10, 1, '审批自习', '2099-06-05', '09:00', '11:00', 2, 1, 'open')`);
  db.run("INSERT INTO study_invite_responses (invite_id, user_id, status) VALUES (10, 1, 'accepted')");

  const join = await call(router, 'post', '/:id/respond', {
    params: { id: '10' },
    userId: 2,
    body: { action: 'join' },
  });

  assert.equal(join.statusCode, 200);
  assert.equal(db.get('SELECT status FROM study_invite_responses WHERE invite_id = 10 AND user_id = 2').status, 'pending');

  const approve = await call(router, 'put', '/:id/responses/:responseId', {
    params: { id: '10', responseId: '2' },
    userId: 1,
    body: { action: 'accept' },
  });

  assert.equal(approve.statusCode, 200);
  assert.equal(db.get('SELECT status FROM study_invite_responses WHERE invite_id = 10 AND user_id = 2').status, 'accepted');
});

test('invite capacity counts accepted creator response without subtracting one', async () => {
  const db = createDb(SQL);
  const router = createInvitesRouter(db);
  db.run(`INSERT INTO study_invites
    (id, creator_id, title, study_date, start_time, end_time, max_participants, approval_required, status)
    VALUES (11, 1, '两人自习', '2099-06-05', '09:00', '11:00', 2, 0, 'open')`);
  db.run("INSERT INTO study_invite_responses (invite_id, user_id, status) VALUES (11, 1, 'accepted')");

  const join = await call(router, 'post', '/:id/respond', {
    params: { id: '11' },
    userId: 2,
    body: { action: 'join' },
  });

  assert.equal(join.statusCode, 200);
  assert.equal(db.get('SELECT status FROM study_invite_responses WHERE invite_id = 11 AND user_id = 2').status, 'accepted');
  assert.equal(db.get('SELECT status FROM study_invites WHERE id = 11').status, 'full');

  const overfill = await call(router, 'post', '/:id/respond', {
    params: { id: '11' },
    userId: 3,
    body: { action: 'join' },
  });

  assert.equal(overfill.statusCode, 400);
});
