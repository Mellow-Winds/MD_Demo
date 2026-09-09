const express = require('express');
const { authMiddleware } = require('./middleware/auth');

/**
 * echo_cave.js — 回声洞语录 API
 * GET  /api/echo-cave/random — 随机获取一条语录（无需认证）
 * POST /api/echo-cave/quotes — 用户提交语录（需认证，每日限 1 条）
 */
module.exports = function (db) {
  const router = express.Router();

  // 随机获取一条语录
  router.get('/random', (req, res) => {
    try {
      const row = db.get(
        'SELECT id, content, source FROM echo_cave_quotes WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1'
      );

      if (!row) {
        return res.json({ content: '回声洞里空空如也……', source: 'system' });
      }

      res.json({ id: row.id, content: row.content, source: row.source });
    } catch (err) {
      console.error('echo-cave random error:', err);
      res.status(500).json({ error: '获取语录失败' });
    }
  });

  // 用户提交语录（每日限 1 条）
  router.post('/quotes', authMiddleware, (req, res) => {
    try {
      const { content } = req.body;
      const authorId = req.user.userId;

      // 内容校验
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: '内容不能为空' });
      }
      const trimmed = content.trim();
      if (trimmed.length < 5) {
        return res.status(400).json({ error: '内容至少 5 个字' });
      }
      if (trimmed.length > 200) {
        return res.status(400).json({ error: '内容最多 200 个字' });
      }

      // 风控：每日限 1 条（用 JS 计算今天日期字符串做比较）
      const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const row = db.get(
        "SELECT COUNT(*) AS cnt FROM echo_cave_quotes WHERE author_id = ? AND source = 'user' AND DATE(created_at) = ?",
        [authorId, today]
      );

      if (row && row.cnt >= 1) {
        return res.status(429).json({ error: '今天已经留过言了，明天再来吧' });
      }

      // 插入
      const result = db.run(
        'INSERT INTO echo_cave_quotes (content, author_id, source) VALUES (?, ?, ?)',
        [trimmed, authorId, 'user']
      );

      res.json({ id: result.lastInsertRowid, content: trimmed });
    } catch (err) {
      console.error('echo-cave post error:', err);
      res.status(500).json({ error: '提交失败，请稍后再试' });
    }
  });

  return router;
};
