/**
 * clean_demo.js — 清空演示数据，保留 10 个测试账号
 *
 * 使用方法：
 *   1. 确保服务器未运行
 *   2. node clean_demo.js
 *   3. 重新启动服务器即可
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'eduspace.db');

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   课搭子 演示数据清理脚本           ║');
  console.log('╚══════════════════════════════════════╝\n');

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ 数据库文件不存在，无需清理');
    return;
  }

  const fileBuffer = fs.readFileSync(DB_PATH);
  const sqlDb = new SQL.Database(fileBuffer);

  function run(sql, params = []) {
    sqlDb.run(sql, params);
    return sqlDb.getRowsModified();
  }

  function all(sql, params = []) {
    const results = sqlDb.exec(sql, params);
    if (results.length === 0) return [];
    return results[0].values.map(row => {
      const obj = {};
      results[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  function save() {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // ─── 找到需要保留的用户 ───
  const keepUsers = all(
    'SELECT id, username FROM users WHERE username LIKE ?',
    ['2300000%']
  );
  const keepIds = keepUsers.map(u => u.id);
  const keepIdSet = new Set(keepIds);

  console.log(`保留用户（${keepUsers.length} 个）：`);
  keepUsers.forEach(u => console.log(`  - ${u.username} (id=${u.id})`));

  // ─── 按外键顺序删除数据 ───
  const deletions = [
    // 先删除依赖表
    ['DELETE FROM comment_likes', []],
    ['DELETE FROM card_vote_records', []],
    ['DELETE FROM card_participants', []],
    ['DELETE FROM explore_post_cards', []],
    ['DELETE FROM explore_comments', []],
    ['DELETE FROM explore_cards', []],
    ['DELETE FROM explore_posts', []],
    ['DELETE FROM square_comments', []],
    ['DELETE FROM square_interests', []],
    ['DELETE FROM square_posts', []],
    ['DELETE FROM study_invite_responses', []],
    ['DELETE FROM study_invites', []],
    ['DELETE FROM material_ratings', []],
    ['DELETE FROM materials', []],
    ['DELETE FROM post_attachments', []],
    ['DELETE FROM comments', []],
    ['DELETE FROM posts', []],
    ['DELETE FROM user_courses', []],
    ['DELETE FROM courses', []],
    ['DELETE FROM favorite_courses', []],
    ['DELETE FROM favorite_posts', []],
    ['DELETE FROM follows', []],
    ['DELETE FROM feedback', []],
    ['DELETE FROM notifications', []],
    ['DELETE FROM contact_exchange_requests', []],
    ['DELETE FROM echo_cave_quotes WHERE author_id IS NOT NULL', []],
    ['DELETE FROM email_verifications', []],
    // 删除非保留用户
    [`DELETE FROM users WHERE id NOT IN (${keepIds.map(() => '?').join(',')})`, keepIds],
  ];

  console.log('\n清理数据表...');
  let totalDeleted = 0;
  for (const [sql, params] of deletions) {
    const changes = run(sql, params);
    if (changes > 0) {
      console.log(`  ${sql.substring(0, 50)}... → ${changes} 行`);
      totalDeleted += changes;
    }
  }

  // ─── 清理上传文件 ───
  console.log('\n清理上传文件...');
  const uploadDirs = [
    'uploads/materials',
    'uploads/comment-images',
    'uploads/post-attachments',
  ];

  let filesDeleted = 0;
  for (const dir of uploadDirs) {
    const fullDir = path.join(__dirname, dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir);
      for (const file of files) {
        const filepath = path.join(fullDir, file);
        if (fs.statSync(filepath).isFile()) {
          fs.unlinkSync(filepath);
          filesDeleted++;
        }
      }
    }
  }
  console.log(`  删除 ${filesDeleted} 个文件`);

  // ─── 重置保留用户的签到和部分数据 ───
  // 保留用户的其他关联数据已被删除，但签到数据在 users 表中
  for (const userId of keepIds) {
    run(
      'UPDATE users SET checkin_streak = 0, last_checkin_date = ?, grace_days = 0 WHERE id = ?',
      ['', userId]
    );
  }

  // ─── 保存数据库 ───
  save();
  sqlDb.close();

  console.log(`\n✅ 清理完成！`);
  console.log(`   删除了 ${totalDeleted} 行数据 + ${filesDeleted} 个文件`);
  console.log(`   保留了 ${keepUsers.length} 个测试账号`);
  console.log(`   密码均为：Test1234\n`);
}

main().catch(e => {
  console.error('清理失败:', e);
  process.exit(1);
});
