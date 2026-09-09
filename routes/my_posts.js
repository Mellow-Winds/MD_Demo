const express = require('express');
const { authMiddleware } = require('./middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/my-posts/course-posts — 当前用户在课程空间发布的帖子
  router.get('/course-posts', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const posts = db.all(`
      SELECT p.*, u.nickname AS author_name, c.title AS course_name,
        (SELECT COUNT(*) FROM comments c2 WHERE c2.post_id = p.id) AS comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      JOIN courses c ON p.course_id = c.id
      WHERE p.author_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);
    res.json(posts);
  });

  // GET /api/my-posts/course-materials — 当前用户在课程空间上传的资料
  router.get('/course-materials', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const materials = db.all(`
      SELECT m.*, u.nickname AS uploader_name, c.title AS course_name
      FROM materials m
      JOIN users u ON m.uploader_id = u.id
      JOIN courses c ON m.course_id = c.id
      WHERE m.uploader_id = ?
      ORDER BY m.created_at DESC
    `, [userId]);
    res.json(materials);
  });

  return router;
};
