const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/user/feed — 关注动态 [Auth]
  router.get('/feed', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 50);
    const offset = (page - 1) * pageSize;

    const activities = db.all(`
      SELECT * FROM (
        SELECT 'material' AS activity_type, m.id AS related_id, m.course_id,
          u.id AS author_id, u.nickname AS author_name, m.title,
          c.title AS context_title, m.description AS summary, m.created_at
        FROM follows f
        JOIN materials m ON m.uploader_id = f.following_id
        JOIN users u ON u.id = m.uploader_id
        JOIN courses c ON c.id = m.course_id
        WHERE f.follower_id = ?

        UNION ALL

        SELECT 'invite' AS activity_type, si.id AS related_id, si.course_id,
          u.id AS author_id, u.nickname AS author_name, si.title,
          COALESCE(c.title, '公开自习邀约') AS context_title, si.description AS summary, si.created_at
        FROM follows f
        JOIN study_invites si ON si.creator_id = f.following_id
        JOIN users u ON u.id = si.creator_id
        LEFT JOIN courses c ON c.id = si.course_id
        WHERE f.follower_id = ? AND si.status IN ('open', 'full') AND si.study_date >= date('now')

        UNION ALL

        SELECT 'square_post' AS activity_type, sp.id AS related_id, NULL AS course_id,
          u.id AS author_id, u.nickname AS author_name, sp.title,
          sp.category AS context_title, sp.description AS summary, sp.created_at
        FROM follows f
        JOIN square_posts sp ON sp.creator_id = f.following_id
        JOIN users u ON u.id = sp.creator_id
        WHERE f.follower_id = ? AND sp.status IN ('open', 'full') AND sp.expires_at > datetime('now')
      ) activities
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, userId, pageSize, offset]);

    res.json({ activities, page, pageSize });
  });

  // GET /api/user/friends — 互关好友列表 [Auth]（@提及选择用）
  router.get('/friends', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const q = (req.query.q || '').trim();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    let sql = `
      SELECT u.id, u.nickname, u.username, u.avatar_url, u.grade, u.major
      FROM follows f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ?
    `;
    const params = [userId];

    if (q) {
      sql += ` AND (u.nickname LIKE ? OR u.username LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY u.nickname ASC LIMIT ?`;
    params.push(limit);

    const friends = db.all(sql, params);
    res.json({ friends });
  });

  // GET /api/user/:id — 用户公开信息
  router.get('/:id', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const user = db.get(
      'SELECT id, nickname, major, grade, avatar_url, privacy_show_profile, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.privacy_show_profile && req.user?.userId !== userId) {
      return res.json({ id: user.id, nickname: user.nickname, avatar_url: user.avatar_url, privacyHidden: true });
    }
    const { privacy_show_profile, ...publicUser } = user;
    res.json(publicUser);
  });

  // GET /api/user/:id/courses — 用户参加的课程（通过 user_courses）
  router.get('/:id/courses', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const user = db.get('SELECT id, privacy_show_profile FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.privacy_show_profile && req.user?.userId !== userId) {
      return res.status(403).json({ error: '该用户未公开个人资料' });
    }
    const courses = db.all(`
      SELECT c.*, uc.enrolled_at
      FROM courses c
      JOIN user_courses uc ON c.id = uc.course_id
      WHERE uc.user_id = ?
      ORDER BY uc.enrolled_at DESC
    `, [userId]);
    res.json(courses);
  });

  // GET /api/user/:id/profile — 公开名片（含关注计数 + 隐私过滤）
  router.get('/:id/profile', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const viewerId = req.user?.userId || null;
    const forcePublicPreview = req.query?.preview === 'public';

    const user = db.get(
      'SELECT id, nickname, major, grade, avatar_url, avatar_desc, mbti, gender, qq, wechat, douyin, privacy_show_profile, privacy_show_following, privacy_show_followers, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const isSelf = !forcePublicPreview && viewerId === userId;

    // 获取关注/粉丝数（受隐私控制）
    const showFollowing = isSelf || user.privacy_show_following !== 0;
    const showFollowers = isSelf || user.privacy_show_followers !== 0;

    const followingCount = showFollowing ? (db.get(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [userId]
    )?.count || 0) : null;
    const followerCount = showFollowers ? (db.get(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [userId]
    )?.count || 0) : null;

    // 是否被当前查看者关注
    let isFollowing = false;
    if (viewerId && !isSelf) {
      const follow = db.get(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
        [viewerId, userId]
      );
      isFollowing = !!follow;
    }

    // 隐私过滤：如果设置了不公开且不是本人查看
    if (!user.privacy_show_profile && !isSelf) {
      return res.json({
        id: user.id,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        privacyHidden: true,
        followingCount,
        followerCount,
        isFollowing,
        privacyShowFollowing: showFollowing,
        privacyShowFollowers: showFollowers
      });
    }

    const commonCourses = viewerId && !isSelf && viewerId !== userId
      ? db.all(`
          SELECT c.id, c.title, c.teacher
          FROM courses c
          JOIN user_courses mine ON mine.course_id = c.id AND mine.user_id = ?
          JOIN user_courses theirs ON theirs.course_id = c.id AND theirs.user_id = ?
          ORDER BY c.title ASC
        `, [viewerId, userId])
      : [];

    res.json({
      ...user,
      followingCount,
      followerCount,
      isFollowing,
      commonCourses,
      privacyShowFollowing: showFollowing,
      privacyShowFollowers: showFollowers
    });
  });

  // POST /api/user/:id/follow — 关注用户
  router.post('/:id/follow', authMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    const myId = req.user.userId;

    if (targetId === myId) {
      return res.status(400).json({ error: '不能关注自己' });
    }

    const target = db.get('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    const existing = db.get(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [myId, targetId]
    );
    if (existing) {
      return res.status(409).json({ error: '已经关注了' });
    }

    db.run(
      'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
      [myId, targetId]
    );
    const follower = db.get('SELECT nickname FROM users WHERE id = ?', [myId]);
    createNotification(db, {
      userId: targetId,
      type: 'new_follower',
      title: '新的关注',
      message: `${follower?.nickname || '一位同学'} 关注了你`,
      relatedType: 'user',
      relatedId: myId
    });
    db.save();

    res.json({ success: true });
  });

  // DELETE /api/user/:id/follow — 取消关注
  router.delete('/:id/follow', authMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    const myId = req.user.userId;

    db.run(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [myId, targetId]
    );
    db.save();

    res.json({ success: true });
  });

  // GET /api/user/:id/followers — 粉丝列表
  router.get('/:id/followers', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const viewerId = req.user?.userId || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    // 隐私检查：非本人需检查 privacy_show_followers
    if (viewerId !== userId) {
      const user = db.get('SELECT privacy_show_followers FROM users WHERE id = ?', [userId]);
      if (user && user.privacy_show_followers === 0) {
        return res.status(403).json({ error: '该用户未公开粉丝列表' });
      }
    }

    const list = db.all(`
      SELECT u.id, u.nickname,
        CASE WHEN u.privacy_show_profile = 1 THEN u.major ELSE '' END AS major,
        CASE WHEN u.privacy_show_profile = 1 THEN u.grade ELSE '' END AS grade,
        u.avatar_url
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    res.json(list);
  });

  // GET /api/user/:id/following — 关注列表
  router.get('/:id/following', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const viewerId = req.user?.userId || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    // 隐私检查：非本人需检查 privacy_show_following
    if (viewerId !== userId) {
      const user = db.get('SELECT privacy_show_following FROM users WHERE id = ?', [userId]);
      if (user && user.privacy_show_following === 0) {
        return res.status(403).json({ error: '该用户未公开关注列表' });
      }
    }

    const list = db.all(`
      SELECT u.id, u.nickname,
        CASE WHEN u.privacy_show_profile = 1 THEN u.major ELSE '' END AS major,
        CASE WHEN u.privacy_show_profile = 1 THEN u.grade ELSE '' END AS grade,
        u.avatar_url
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    res.json(list);
  });

  // POST /api/user/:id/contact-exchange — 发送交换联系方式请求
  router.post('/:id/contact-exchange', authMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    const myId = req.user.userId;
    const { message } = req.body;

    if (targetId === myId) {
      return res.status(400).json({ error: '不能向自己发送交换请求' });
    }

    const target = db.get('SELECT id, nickname FROM users WHERE id = ?', [targetId]);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    // 检查是否已有待处理的请求（双向检查）
    const accepted = db.get(
      `SELECT id FROM contact_exchange_requests
       WHERE status = 'accepted'
       AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
       ORDER BY resolved_at DESC, created_at DESC
       LIMIT 1`,
      [myId, targetId, targetId, myId]
    );
    if (accepted) {
      return res.json({
        success: true,
        alreadyAccepted: true,
        status: 'accepted',
        requestId: accepted.id
      });
    }

    const existing = db.get(
      `SELECT id FROM contact_exchange_requests
       WHERE status = 'pending'
       AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))`,
      [myId, targetId, targetId, myId]
    );
    if (existing) {
      return res.status(409).json({ error: '已存在待处理的交换请求' });
    }

    const insertResult = db.run(
      'INSERT INTO contact_exchange_requests (from_user_id, to_user_id, message) VALUES (?, ?, ?)',
      [myId, targetId, message || '']
    );

    const sender = db.get('SELECT nickname FROM users WHERE id = ?', [myId]);
    createNotification(db, {
      userId: targetId,
      type: 'contact_exchange_request',
      title: '交换联系方式请求',
      message: `${sender?.nickname || '一位同学'} 请求与你交换联系方式`,
      relatedType: 'contact_exchange',
      relatedId: insertResult.lastInsertRowid
    });
    db.save();

    res.json({ success: true, status: 'pending', requestId: insertResult.lastInsertRowid });
  });

  // GET /api/user/contact-exchange/:id — 获取交换请求详情
  router.get('/contact-exchange/:id', authMiddleware, (req, res) => {
    const requestId = Number(req.params.id);
    const userId = req.user.userId;

    const request = db.get(
      `SELECT cer.*, u.nickname, u.avatar_url, u.major, u.grade, u.qq, u.wechat, u.douyin
       FROM contact_exchange_requests cer
       JOIN users u ON u.id = cer.from_user_id
       WHERE cer.id = ?`,
      [requestId]
    );

    if (!request) return res.status(404).json({ error: '请求不存在' });

    // 只有请求双方可以查看
    if (request.from_user_id !== userId && request.to_user_id !== userId) {
      return res.status(403).json({ error: '无权查看此请求' });
    }

    // 如果已同意，双方都能看到对方的联系方式
    const toUser = db.get(
      'SELECT id, nickname, avatar_url, major, grade FROM users WHERE id = ?',
      [request.to_user_id]
    );
    const otherUserId = request.from_user_id === userId ? request.to_user_id : request.from_user_id;
    const otherUser = db.get(
      'SELECT id, nickname, avatar_url, major, grade FROM users WHERE id = ?',
      [otherUserId]
    );

    let contactInfo = null;
    if (request.status === 'accepted') {
      const other = db.get('SELECT nickname, qq, wechat, douyin FROM users WHERE id = ?', [otherUserId]);
      contactInfo = other;
    }

    res.json({
      id: request.id,
      fromUserId: request.from_user_id,
      toUserId: request.to_user_id,
      message: request.message,
      status: request.status,
      createdAt: request.created_at,
      resolvedAt: request.resolved_at,
      fromUser: {
        id: request.from_user_id,
        nickname: request.nickname,
        avatar_url: request.avatar_url,
        major: request.major,
        grade: request.grade
      },
      toUser,
      otherUser,
      contactInfo
    });
  });

  // PUT /api/user/contact-exchange/:id/accept — 同意交换
  router.put('/contact-exchange/:id/accept', authMiddleware, (req, res) => {
    const requestId = Number(req.params.id);
    const userId = req.user.userId;

    const request = db.get(
      'SELECT * FROM contact_exchange_requests WHERE id = ?',
      [requestId]
    );

    if (!request) return res.status(404).json({ error: '请求不存在' });
    if (request.to_user_id !== userId) return res.status(403).json({ error: '无权操作此请求' });
    if (request.status !== 'pending') return res.status(400).json({ error: '该请求已处理' });

    db.run(
      "UPDATE contact_exchange_requests SET status = 'accepted', resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
      [requestId]
    );

    // 获取双方联系方式发给请求方
    const accepter = db.get('SELECT nickname, qq, wechat, douyin FROM users WHERE id = ?', [userId]);
    const requester = db.get('SELECT nickname, qq, wechat, douyin FROM users WHERE id = ?', [request.from_user_id]);

    createNotification(db, {
      userId: request.from_user_id,
      type: 'contact_exchange_accepted',
      title: '交换请求已通过',
      message: `${accepter?.nickname || '对方'} 同意了你的交换联系方式请求，点击查看`,
      relatedType: 'contact_exchange',
      relatedId: requestId
    });
    db.save();

    res.json({ success: true });
  });

  // PUT /api/user/contact-exchange/:id/reject — 拒绝交换
  router.put('/contact-exchange/:id/reject', authMiddleware, (req, res) => {
    const requestId = Number(req.params.id);
    const userId = req.user.userId;

    const request = db.get(
      'SELECT * FROM contact_exchange_requests WHERE id = ?',
      [requestId]
    );

    if (!request) return res.status(404).json({ error: '请求不存在' });
    if (request.to_user_id !== userId) return res.status(403).json({ error: '无权操作此请求' });
    if (request.status !== 'pending') return res.status(400).json({ error: '该请求已处理' });

    db.run(
      "UPDATE contact_exchange_requests SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
      [requestId]
    );

    const rejecter = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);

    createNotification(db, {
      userId: request.from_user_id,
      type: 'contact_exchange_rejected',
      title: '交换请求被拒绝',
      message: `${rejecter?.nickname || '对方'} 拒绝了你的交换联系方式请求`,
      relatedType: 'contact_exchange',
      relatedId: requestId
    });
    db.save();

    res.json({ success: true });
  });

  // POST /api/user/feedback — 问题反馈
  router.post('/feedback', authMiddleware, (req, res) => {
    const { category, content, contact } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '反馈内容不能为空' });
    }

    db.run(
      'INSERT INTO feedback (user_id, category, content, contact) VALUES (?, ?, ?, ?)',
      [req.user.userId, category || 'bug', content.trim(), contact || '']
    );
    db.save();

    res.json({ success: true });
  });

  return router;
};
