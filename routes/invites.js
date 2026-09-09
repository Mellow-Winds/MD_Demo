const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

function normalizeMaxParticipants(value, fallback = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(2, Math.min(50, Math.floor(parsed)));
}

module.exports = function (db) {
  const router = express.Router();

  // POST /api/invites — 发布邀约 [Auth]
  router.post('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const {
      course_id,
      title,
      description,
      study_date,
      start_time,
      end_time,
      location,
      max_participants,
      approval_required,
    } = req.body;

    if (!title || !study_date || !start_time || !end_time) {
      return res.status(400).json({ error: '标题、日期、时间为必填项' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: '结束时间必须晚于开始时间' });
    }

    const maxParticipants = normalizeMaxParticipants(max_participants);
    const approvalRequired = approval_required ? 1 : 0;

    const result = db.run(
      `INSERT INTO study_invites
        (creator_id, course_id, title, description, study_date, start_time, end_time, location, max_participants, approval_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        course_id || null,
        title.trim(),
        (description || '').trim(),
        study_date,
        start_time,
        end_time,
        (location || '').trim(),
        maxParticipants,
        approvalRequired,
      ],
    );

    db.run(
      "INSERT INTO study_invite_responses (invite_id, user_id, status) VALUES (?, ?, 'accepted')",
      [result.lastInsertRowid, userId],
    );
    db.save();

    res.status(201).json({ id: result.lastInsertRowid, message: '发布成功' });
  });

  // GET /api/invites — 浏览邀约列表
  router.get('/', optionalAuthMiddleware, (req, res) => {
    const { course_id, date, status, page = 1, pageSize = 20 } = req.query;

    let where = ' WHERE 1=1';
    const params = [];

    if (course_id) {
      where += ' AND si.course_id = ?';
      params.push(Number(course_id));
    }
    if (date === 'today') {
      where += " AND si.study_date = date('now', '+8 hours')";
    } else if (date === 'week') {
      where += " AND si.study_date BETWEEN date('now', '+8 hours') AND date('now', '+8 hours', '+7 days')";
    } else if (date && date !== 'all') {
      where += ' AND si.study_date = ?';
      params.push(date);
    }
    if (status && status !== 'all') {
      where += ' AND si.status = ?';
      params.push(status);
    }

    const total = (db.get(`SELECT COUNT(*) AS total FROM study_invites si${where}`, params) || {}).total || 0;
    const userId = req.user ? req.user.userId : null;
    const sql = `
      SELECT si.*,
        u.nickname AS creator_name,
        (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
        (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'pending') AS pending_count
        ${userId ? `, (SELECT sir2.status FROM study_invite_responses sir2 WHERE sir2.invite_id = si.id AND sir2.user_id = ?) AS my_status` : ''}
      FROM study_invites si
      JOIN users u ON si.creator_id = u.id
      ${where}
      ORDER BY si.study_date ASC, si.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const dataParams = userId ? [userId, ...params] : [...params];
    const offset = (Number(page) - 1) * Number(pageSize);
    dataParams.push(Number(pageSize), offset);

    const invites = db.all(sql, dataParams);
    res.json({ invites, total, page: Number(page), pageSize: Number(pageSize) });
  });

  // GET /api/invites/my — 我发起的 + 我参与的 [Auth]
  router.get('/my', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { type } = req.query;

    let invites;
    if (type === 'created') {
      invites = db.all(`
        SELECT si.*,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'pending') AS pending_count
        FROM study_invites si
        WHERE si.creator_id = ?
        ORDER BY si.study_date DESC, si.start_time DESC
      `, [userId]);
    } else if (type === 'joined') {
      invites = db.all(`
        SELECT si.*, u.nickname AS creator_name,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
          resp.status AS my_status
        FROM study_invite_responses resp
        JOIN study_invites si ON resp.invite_id = si.id
        JOIN users u ON si.creator_id = u.id
        WHERE resp.user_id = ? AND resp.status IN ('accepted', 'pending') AND si.creator_id != ?
        ORDER BY si.study_date DESC, si.start_time DESC
      `, [userId, userId]);
    } else {
      const created = db.all(`
        SELECT si.*, 'creator' AS role,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'pending') AS pending_count
        FROM study_invites si WHERE si.creator_id = ?
      `, [userId]);
      const joined = db.all(`
        SELECT si.*, u.nickname AS creator_name, 'participant' AS role,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
          resp.status AS my_status
        FROM study_invite_responses resp
        JOIN study_invites si ON resp.invite_id = si.id
        JOIN users u ON si.creator_id = u.id
        WHERE resp.user_id = ? AND resp.status IN ('accepted', 'pending') AND si.creator_id != ?
      `, [userId, userId]);
      invites = [...created, ...joined].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    res.json(invites);
  });

  // GET /api/invites/:id — 邀约详情 + 参与者
  router.get('/:id', optionalAuthMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const invite = db.get(`
      SELECT si.*, u.nickname AS creator_name,
        (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
        (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'pending') AS pending_count
      FROM study_invites si
      JOIN users u ON si.creator_id = u.id
      WHERE si.id = ?
    `, [inviteId]);

    if (!invite) return res.status(404).json({ error: '邀约不存在' });

    const participants = db.all(`
      SELECT sir.id AS response_id, sir.status, u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url
      FROM study_invite_responses sir
      JOIN users u ON sir.user_id = u.id
      WHERE sir.invite_id = ? AND sir.status = 'accepted'
      ORDER BY sir.created_at ASC
    `, [inviteId]);

    const pending = invite.creator_id === (req.user?.userId || null)
      ? db.all(`
        SELECT sir.id AS response_id, u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url, sir.created_at
        FROM study_invite_responses sir
        JOIN users u ON sir.user_id = u.id
        WHERE sir.invite_id = ? AND sir.status = 'pending'
        ORDER BY sir.created_at ASC
      `, [inviteId])
      : [];

    res.json({ ...invite, participants, pending });
  });

  // POST /api/invites/:id/respond — 响应邀约（加入/取消）[Auth]
  router.post('/:id/respond', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const userId = req.user.userId;
    const { action } = req.body;

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });

    if (invite.status === 'closed') return res.status(400).json({ error: '该邀约已关闭' });
    if (invite.status === 'expired') return res.status(400).json({ error: '该邀约已过期' });

    const existing = db.get(
      'SELECT * FROM study_invite_responses WHERE invite_id = ? AND user_id = ?',
      [inviteId, userId],
    );

    if (action === 'cancel') {
      if (!existing) return res.status(400).json({ error: '你未参与该邀约' });
      db.run('DELETE FROM study_invite_responses WHERE invite_id = ? AND user_id = ?', [inviteId, userId]);
      if (invite.status === 'full') {
        db.run("UPDATE study_invites SET status = 'open' WHERE id = ?", [inviteId]);
      }
      db.save();
      return res.json({ message: '已取消参与' });
    }

    if (existing) return res.status(400).json({ error: '你已参与或申请过该邀约' });
    if (invite.creator_id === userId) return res.status(400).json({ error: '你是邀约发起人，无需重复加入' });

    const count = db.get(
      "SELECT COUNT(*) AS cnt FROM study_invite_responses WHERE invite_id = ? AND status = 'accepted'",
      [inviteId],
    );
    if (count.cnt >= invite.max_participants) {
      return res.status(400).json({ error: '人数已满' });
    }

    const responseStatus = invite.approval_required ? 'pending' : 'accepted';
    db.run(
      'INSERT INTO study_invite_responses (invite_id, user_id, status) VALUES (?, ?, ?)',
      [inviteId, userId, responseStatus],
    );

    if (responseStatus === 'accepted' && count.cnt + 1 >= invite.max_participants) {
      db.run("UPDATE study_invites SET status = 'full' WHERE id = ?", [inviteId]);
    }
    db.save();

    const joiner = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);
    createNotification(db, {
      userId: invite.creator_id,
      type: 'invite_join',
      title: invite.approval_required ? '新的自习加入申请' : '有人加入自习',
      message: invite.approval_required
        ? `${joiner?.nickname || '匿名'} 申请加入你的自习邀约「${invite.title}」`
        : `${joiner?.nickname || '匿名'} 加入了你的自习邀约「${invite.title}」`,
      relatedType: 'invite',
      relatedId: inviteId,
    });
    db.save();

    res.json({ message: responseStatus === 'pending' ? '已提交申请，等待发起人批准' : '加入成功' });
  });

  // PUT /api/invites/:id/responses/:responseId — 审批加入申请 [Auth, 仅创建者]
  router.put('/:id/responses/:responseId', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const responseId = Number(req.params.responseId);
    const userId = req.user.userId;
    const { action } = req.body;

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });
    if (invite.creator_id !== userId) return res.status(403).json({ error: '只能处理自己发布的邀约申请' });

    const response = db.get('SELECT * FROM study_invite_responses WHERE id = ? AND invite_id = ?', [responseId, inviteId]);
    if (!response) return res.status(404).json({ error: '申请不存在' });
    if (response.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });

    if (action === 'reject') {
      db.run("UPDATE study_invite_responses SET status = 'rejected' WHERE id = ?", [responseId]);
      createNotification(db, {
        userId: response.user_id,
        type: 'invite_rejected',
        title: '自习申请未通过',
        message: `你加入「${invite.title}」的申请未通过`,
        relatedType: 'invite',
        relatedId: inviteId,
      });
      db.save();
      return res.json({ message: '已拒绝' });
    }

    if (action !== 'accept') {
      return res.status(400).json({ error: '无效操作' });
    }

    const count = db.get(
      "SELECT COUNT(*) AS cnt FROM study_invite_responses WHERE invite_id = ? AND status = 'accepted'",
      [inviteId],
    );
    if (count.cnt >= invite.max_participants) {
      return res.status(400).json({ error: '人数已满' });
    }

    db.run("UPDATE study_invite_responses SET status = 'accepted' WHERE id = ?", [responseId]);
    if (count.cnt + 1 >= invite.max_participants) {
      db.run("UPDATE study_invites SET status = 'full' WHERE id = ?", [inviteId]);
    }
    createNotification(db, {
      userId: response.user_id,
      type: 'invite_accepted',
      title: '自习申请已通过',
      message: `你已加入「${invite.title}」`,
      relatedType: 'invite',
      relatedId: inviteId,
    });
    db.save();
    res.json({ message: '已通过' });
  });

  // PUT /api/invites/:id — 编辑邀约 [Auth, 仅创建者]
  router.put('/:id', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const userId = req.user.userId;

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });
    if (invite.creator_id !== userId) return res.status(403).json({ error: '只能编辑自己发布的邀约' });

    const { title, description, study_date, start_time, end_time, location, max_participants, approval_required, status } = req.body;
    const nextMax = max_participants !== undefined
      ? normalizeMaxParticipants(max_participants, invite.max_participants)
      : invite.max_participants;

    db.run(
      `UPDATE study_invites
       SET title = ?, description = ?, study_date = ?, start_time = ?, end_time = ?, location = ?, max_participants = ?, approval_required = ?, status = ?
       WHERE id = ?`,
      [
        title !== undefined ? title.trim() : invite.title,
        description !== undefined ? description.trim() : invite.description,
        study_date || invite.study_date,
        start_time || invite.start_time,
        end_time || invite.end_time,
        location !== undefined ? location.trim() : invite.location,
        nextMax,
        approval_required !== undefined ? (approval_required ? 1 : 0) : invite.approval_required,
        status || invite.status,
        inviteId,
      ],
    );
    db.save();
    res.json({ message: '更新成功' });
  });

  // DELETE /api/invites/:id — 取消邀约 [Auth, 仅创建者]
  router.delete('/:id', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const userId = req.user.userId;

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });
    if (invite.creator_id !== userId) return res.status(403).json({ error: '只能取消自己发布的邀约' });

    const participants = db.all(
      "SELECT user_id FROM study_invite_responses WHERE invite_id = ? AND user_id != ? AND status IN ('accepted', 'pending')",
      [inviteId, userId],
    );
    for (const p of participants) {
      createNotification(db, {
        userId: p.user_id,
        type: 'invite_cancel',
        title: '自习邀约已取消',
        message: `「${invite.title}」已被发起人取消`,
        relatedType: 'invite',
        relatedId: inviteId,
      });
    }
    db.save();

    db.run('DELETE FROM study_invites WHERE id = ?', [inviteId]);
    db.save();
    res.json({ message: '已取消' });
  });

  return router;
};
