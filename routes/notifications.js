const express = require('express');
const { authMiddleware } = require('./middleware/auth');

// 通知辅助函数 — 供其他路由调用
function createNotification(db, { userId, type, title, message, relatedType, relatedId, relatedCommentId, courseId }) {
  let hasCommentAnchor = false;
  try {
    hasCommentAnchor = db.all("PRAGMA table_info(notifications)").some(col => col.name === 'related_comment_id');
  } catch {
    hasCommentAnchor = false;
  }

  if (!hasCommentAnchor) {
    db.run(
      `INSERT INTO notifications (user_id, type, title, message, related_type, related_id, course_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, title, message, relatedType || null, relatedId || null, courseId || null]
    );
    return;
  }

  db.run(
    `INSERT INTO notifications (user_id, type, title, message, related_type, related_id, related_comment_id, course_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, relatedType || null, relatedId || null, relatedCommentId || null, courseId || null]
  );
}

// 批量通知：课程所有成员（排除指定用户）
function notifyCourseMembers(db, { courseId, excludeUserId, type, title, message, relatedType, relatedId }) {
  const members = db.all(
    'SELECT user_id FROM user_courses WHERE course_id = ? AND user_id != ?',
    [courseId, excludeUserId]
  );
  for (const m of members) {
    createNotification(db, {
      userId: m.user_id, type, title, message, relatedType, relatedId, courseId
    });
  }
}

module.exports = function (db) {
  const router = express.Router();

  // GET /api/notifications — 通知列表 [Auth]
  router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { page = 1, pageSize = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const total = (db.get('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ?', [userId]) || {}).cnt || 0;
    const unread = (db.get('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [userId]) || {}).cnt || 0;

    const notifications = db.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, Number(pageSize), offset]
    );

    res.json({ notifications, total, unread, page: Number(page), pageSize: Number(pageSize) });
  });

  // GET /api/notifications/unread-count — 未读数量 [Auth]
  router.get('/unread-count', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const row = db.get('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
    res.json({ count: row ? row.cnt : 0 });
  });

  // PUT /api/notifications/:id/read — 标记单条已读 [Auth]
  router.put('/:id/read', authMiddleware, (req, res) => {
    const notifId = Number(req.params.id);
    db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, req.user.userId]);
    db.save();
    res.json({ message: 'ok' });
  });

  // PUT /api/notifications/read-all — 全部已读 [Auth]
  router.put('/read-all', authMiddleware, (req, res) => {
    db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.userId]);
    db.save();
    res.json({ message: 'ok' });
  });

  // POST /api/notifications/batch-delete — 批量删除 [Auth]
  router.post('/batch-delete', authMiddleware, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的通知 ID 列表' });
    }
    const userId = req.user.userId;
    let deleted = 0;
    for (const id of ids) {
      const result = db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [Number(id), userId]);
      if (result.changes > 0) deleted++;
    }
    db.save();
    res.json({ message: `已删除 ${deleted} 条通知`, deleted });
  });

  return router;
};

// 导出辅助函数供其他路由使用
module.exports.createNotification = createNotification;
module.exports.notifyCourseMembers = notifyCourseMembers;
