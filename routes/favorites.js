const express = require('express');
const { authMiddleware } = require('./middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { type } = req.query;

    if (type === 'courses') {
      const courses = db.all(`
        SELECT c.*, fc.created_at AS favorited_at
        FROM favorite_courses fc
        JOIN courses c ON c.id = fc.course_id
        WHERE fc.user_id = ?
        ORDER BY fc.created_at DESC, fc.id DESC
      `, [userId]);

      // 修正选课人数：大课跨子课程聚合，小课直接计数
      for (const course of courses) {
        const isBig = !course.big_course_id && (!course.description || course.description === '');
        if (isBig) {
          const row = db.get(
            'SELECT COUNT(*) AS cnt FROM user_courses uc JOIN courses c2 ON uc.course_id = c2.id WHERE c2.big_course_id = ?',
            [course.id]
          );
          course.enrollment_count = row ? row.cnt : 0;
        } else {
          const row = db.get(
            'SELECT COUNT(*) AS cnt FROM user_courses WHERE course_id = ?',
            [course.id]
          );
          course.enrollment_count = row ? row.cnt : 0;
        }
      }

      return res.json(courses);
    }

    if (type === 'posts') {
      return res.json(db.all(`
        SELECT p.*, fp.created_at AS favorited_at,
          c.title AS course_title, u.nickname AS author_name
        FROM favorite_posts fp
        JOIN posts p ON p.id = fp.post_id
        JOIN courses c ON c.id = p.course_id
        JOIN users u ON u.id = p.author_id
        WHERE fp.user_id = ?
        ORDER BY fp.created_at DESC, fp.id DESC
      `, [userId]));
    }

    res.status(400).json({ error: 'type 参数无效' });
  });

  router.post('/courses/:courseId', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const courseId = Number(req.params.courseId);
    if (!db.get('SELECT id FROM courses WHERE id = ?', [courseId])) {
      return res.status(404).json({ error: '课程不存在' });
    }
    const existing = db.get(
      'SELECT id FROM favorite_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    if (existing) return res.json({ message: '已收藏' });
    db.run('INSERT INTO favorite_courses (user_id, course_id) VALUES (?, ?)', [userId, courseId]);
    db.save();
    res.status(201).json({ message: '收藏成功' });
  });

  router.delete('/courses/:courseId', authMiddleware, (req, res) => {
    db.run(
      'DELETE FROM favorite_courses WHERE user_id = ? AND course_id = ?',
      [req.user.userId, Number(req.params.courseId)]
    );
    db.save();
    res.json({ message: '已取消收藏' });
  });

  router.post('/posts/:postId', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const postId = Number(req.params.postId);
    if (!db.get('SELECT id FROM posts WHERE id = ?', [postId])) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    const existing = db.get(
      'SELECT id FROM favorite_posts WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    if (existing) return res.json({ message: '已收藏' });
    db.run('INSERT INTO favorite_posts (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    db.save();
    res.status(201).json({ message: '收藏成功' });
  });

  router.delete('/posts/:postId', authMiddleware, (req, res) => {
    db.run(
      'DELETE FROM favorite_posts WHERE user_id = ? AND post_id = ?',
      [req.user.userId, Number(req.params.postId)]
    );
    db.save();
    res.json({ message: '已取消收藏' });
  });

  return router;
};
