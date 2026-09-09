const express = require('express');
const { authMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

module.exports = function (db) {
  const router = express.Router();

  // POST /api/explore/cards/:id/join — 加入/取消 [Auth]
  router.post('/:id/join', authMiddleware, (req, res) => {
    const cardId = parseInt(req.params.id);
    const userId = req.user.userId;
    const { action } = req.body; // 'join' | 'cancel'

    const card = db.get('SELECT * FROM explore_cards WHERE id = ?', [cardId]);
    if (!card) return res.status(404).json({ error: '卡片不存在' });

    if (action === 'cancel') {
      const existing = db.get(
        'SELECT id FROM card_participants WHERE card_id = ? AND user_id = ?',
        [cardId, userId]
      );
      if (!existing) return res.status(400).json({ error: '你未参与此卡片' });

      db.run('DELETE FROM card_participants WHERE card_id = ? AND user_id = ?', [cardId, userId]);
      if (card.current_count > 0) {
        db.run('UPDATE explore_cards SET current_count = current_count - 1 WHERE id = ?', [cardId]);
      }
      db.save();
      return res.json({ message: '已取消' });
    }

    // action === 'join'
    const existing = db.get(
      'SELECT id, status FROM card_participants WHERE card_id = ? AND user_id = ?',
      [cardId, userId]
    );
    if (existing) return res.status(400).json({ error: '你已参与此卡片' });

    if (card.max_participants > 0 && card.current_count >= card.max_participants) {
      return res.status(400).json({ error: '人数已满' });
    }

    const status = card.approval_required ? 'pending' : 'accepted';
    db.run(
      'INSERT INTO card_participants (card_id, user_id, status) VALUES (?, ?, ?)',
      [cardId, userId, status]
    );

    if (status === 'accepted') {
      db.run('UPDATE explore_cards SET current_count = current_count + 1 WHERE id = ?', [cardId]);
      // 检查是否满员
      if (card.max_participants > 0 && card.current_count + 1 >= card.max_participants) {
        db.run("UPDATE explore_cards SET status = 'full' WHERE id = ?", [cardId]);
      }
    }

    // 通知创建者
    const user = db.get('SELECT nickname, username FROM users WHERE id = ?', [userId]);
    const userName = user?.nickname || user?.username || '某用户';
    createNotification(db, {
      userId: card.creator_id,
      type: 'card_join',
      title: status === 'pending' ? '新的加入申请' : '有人加入了你的卡片',
      message: `${userName} ${status === 'pending' ? '申请加入' : '已加入'}「${card.title}」`,
      relatedType: 'card',
      relatedId: cardId
    });

    db.save();
    res.json({ message: status === 'pending' ? '已申请，等待批准' : '已加入', status });
  });

  // PUT /api/explore/cards/:id/participants/:pid — 审批 [Auth, 仅创建者]
  router.put('/:id/participants/:pid', authMiddleware, (req, res) => {
    const cardId = parseInt(req.params.id);
    const pid = parseInt(req.params.pid);
    const userId = req.user.userId;
    const { action } = req.body; // 'accept' | 'reject'

    const card = db.get('SELECT * FROM explore_cards WHERE id = ?', [cardId]);
    if (!card) return res.status(404).json({ error: '卡片不存在' });
    if (card.creator_id !== userId) return res.status(403).json({ error: '无权操作' });

    const participant = db.get('SELECT * FROM card_participants WHERE id = ? AND card_id = ?', [pid, cardId]);
    if (!participant) return res.status(404).json({ error: '申请不存在' });
    if (participant.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    db.run('UPDATE card_participants SET status = ? WHERE id = ?', [newStatus, pid]);

    if (newStatus === 'accepted') {
      db.run('UPDATE explore_cards SET current_count = current_count + 1 WHERE id = ?', [cardId]);
      if (card.max_participants > 0 && card.current_count + 1 >= card.max_participants) {
        db.run("UPDATE explore_cards SET status = 'full' WHERE id = ?", [cardId]);
      }
    }

    // 通知申请人
    createNotification(db, {
      userId: participant.user_id,
      type: 'card_join_result',
      title: newStatus === 'accepted' ? '申请已通过' : '申请未通过',
      message: `你申请加入「${card.title}」${newStatus === 'accepted' ? '已通过' : '未通过'}`,
      relatedType: 'card',
      relatedId: cardId
    });

    db.save();
    res.json({ message: newStatus === 'accepted' ? '已通过' : '已拒绝' });
  });

  // POST /api/explore/cards/:id/vote/:moduleIndex — 投票 [Auth]
  router.post('/:id/vote/:moduleIndex', authMiddleware, (req, res) => {
    const cardId = parseInt(req.params.id);
    const moduleIndex = parseInt(req.params.moduleIndex);
    const userId = req.user.userId;
    const { option_id } = req.body;

    if (!option_id) return res.status(400).json({ error: '选项ID为必填项' });

    const card = db.get('SELECT components FROM explore_cards WHERE id = ?', [cardId]);
    if (!card) return res.status(404).json({ error: '卡片不存在' });

    let components = [];
    try { components = JSON.parse(card.components); } catch (e) { /* ignore */ }

    const module = components[moduleIndex];
    if (!module || module.type !== 'vote') {
      return res.status(400).json({ error: '该模块不是投票类型' });
    }

    const option = (module.options || []).find(o => o.id === option_id);
    if (!option) return res.status(400).json({ error: '无效的选项' });

    // 检查是否已投票（同一模块同一选项）
    const existing = db.get(
      'SELECT id FROM card_vote_records WHERE card_id = ? AND module_index = ? AND user_id = ? AND option_id = ?',
      [cardId, moduleIndex, userId, option_id]
    );
    if (existing) return res.status(400).json({ error: '你已投过此选项' });

    // 如果不是multi，先删除该用户在该模块的所有投票
    if (!module.multi) {
      db.run(
        'DELETE FROM card_vote_records WHERE card_id = ? AND module_index = ? AND user_id = ?',
        [cardId, moduleIndex, userId]
      );
    }

    // 记录投票
    db.run(
      'INSERT INTO card_vote_records (card_id, module_index, user_id, option_id) VALUES (?, ?, ?, ?)',
      [cardId, moduleIndex, userId, option_id]
    );

    // 更新 components 中的 votes 计数
    const optIndex = module.options.findIndex(o => o.id === option_id);
    if (optIndex >= 0) {
      module.options[optIndex].votes = (module.options[optIndex].votes || 0) + 1;
      components[moduleIndex] = module;
      db.run('UPDATE explore_cards SET components = ? WHERE id = ?', [JSON.stringify(components), cardId]);
    }

    db.save();
    res.json({ message: '投票成功' });
  });

  // DELETE /api/explore/cards/:id/vote/:moduleIndex — 取消投票 [Auth]
  router.delete('/:id/vote/:moduleIndex', authMiddleware, (req, res) => {
    const cardId = parseInt(req.params.id);
    const moduleIndex = parseInt(req.params.moduleIndex);
    const userId = req.user.userId;
    const { option_id } = req.body;

    const card = db.get('SELECT components FROM explore_cards WHERE id = ?', [cardId]);
    if (!card) return res.status(404).json({ error: '卡片不存在' });

    // 删除投票记录
    if (option_id) {
      db.run(
        'DELETE FROM card_vote_records WHERE card_id = ? AND module_index = ? AND user_id = ? AND option_id = ?',
        [cardId, moduleIndex, userId, option_id]
      );
      // 更新计数
      let components = [];
      try { components = JSON.parse(card.components); } catch (e) { /* ignore */ }
      const module = components[moduleIndex];
      if (module && module.options) {
        const opt = module.options.find(o => o.id === option_id);
        if (opt && opt.votes > 0) opt.votes--;
        components[moduleIndex] = module;
        db.run('UPDATE explore_cards SET components = ? WHERE id = ?', [JSON.stringify(components), cardId]);
      }
    } else {
      db.run(
        'DELETE FROM card_vote_records WHERE card_id = ? AND module_index = ? AND user_id = ?',
        [cardId, moduleIndex, userId]
      );
    }

    db.save();
    res.json({ message: '已取消投票' });
  });

  // GET /api/explore/cards/:id/participants — 获取参与者列表
  router.get('/:id/participants', (req, res) => {
    const cardId = parseInt(req.params.id);
    const participants = db.all(
      `SELECT cp.id, cp.user_id, cp.status, cp.created_at,
        u.username, u.nickname, u.avatar_url, u.major, u.grade
       FROM card_participants cp
       LEFT JOIN users u ON u.id = cp.user_id
       WHERE cp.card_id = ?
       ORDER BY cp.created_at`,
      [cardId]
    );
    res.json(participants);
  });

  return router;
};
