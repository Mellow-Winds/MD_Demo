import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createSearchRouter from '../routes/search.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, nickname TEXT);
    CREATE TABLE courses (
      id INTEGER PRIMARY KEY, title TEXT, description TEXT, teacher TEXT,
      semester TEXT, created_at TEXT
    );
    CREATE TABLE user_courses (course_id INTEGER);
    CREATE TABLE materials (
      id INTEGER PRIMARY KEY, title TEXT, description TEXT, chapter TEXT,
      category TEXT, course_id INTEGER, uploader_id INTEGER, created_at TEXT
    );
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY, title TEXT, content TEXT, course_id INTEGER,
      author_id INTEGER, created_at TEXT
    );
    CREATE TABLE square_posts (
      id INTEGER PRIMARY KEY, creator_id INTEGER, title TEXT, category TEXT,
      description TEXT, max_people INTEGER, current_count INTEGER,
      status TEXT, expires_at TEXT, created_at TEXT
    );

    INSERT INTO users VALUES (1, '小林');
    INSERT INTO square_posts VALUES
      (1, 1, '线性代数考研搭子', '考研搭子', '一起刷线性代数题', 2, 0, 'open', datetime('now', '+2 day'), '2026-06-02 09:00:00'),
      (2, 1, '线性代数冲刺小组', '考研搭子', '名额已满但仍可查看', 1, 1, 'full', datetime('now', '+1 day'), '2026-06-02 10:00:00'),
      (3, 1, '线性代数过期小组', '考研搭子', '不应出现在搜索结果中', 2, 0, 'open', datetime('now', '-1 day'), '2026-06-02 11:00:00'),
      (4, 1, '英语口语练习', '技能交换', '与查询关键词无关', 2, 0, 'open', datetime('now', '+2 day'), '2026-06-02 12:00:00');
  `);

  return {
    all(sql, params = []) {
      const stmt = raw.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  };
}

function runSearch(db, query) {
  const router = createSearchRouter(db);
  const layer = router.stack.find(item => item.route?.path === '/' && item.route.methods.get);
  let statusCode = 200;
  let body;

  layer.route.stack[0].handle(
    { query },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
    },
  );

  return { statusCode, body };
}

const SQL = await initSqlJs();

test('type=squarePosts returns matching visible square posts including full posts', () => {
  const result = runSearch(createDb(SQL), { q: '线性代数', type: 'squarePosts' });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.squarePosts.map(post => post.id), [2, 1]);
  assert.equal(result.body.squarePosts[0].creator_name, '小林');
  assert.equal(result.body.total, 2);
});

test('type=all includes square posts in the total', () => {
  const result = runSearch(createDb(SQL), { q: '线性代数', type: 'all' });

  assert.deepEqual(result.body.squarePosts.map(post => post.id), [2, 1]);
  assert.equal(result.body.total, 2);
});
