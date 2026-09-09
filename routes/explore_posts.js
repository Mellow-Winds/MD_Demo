const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // ========== 辅助函数 ==========

  /**
   * 从 content JSON 字符串中提取文字摘要和卡片预览
   * content 格式: [{ type: 'text', data: '...' }, { type: 'card', card: { title, components, ... } }, ...]
   */
  function parseContentBlocks(contentStr) {
    if (!contentStr) return [];
    try {
      const parsed = JSON.parse(contentStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // 兼容旧格式：纯文本 content
      return contentStr.trim() ? [{ type: 'text', data: contentStr }] : [];
    }
  }

  function extractTextPreview(blocks, maxLen = 120) {
    return blocks
      .filter(b => b.type === 'text' && b.data)
      .map(b => b.data)
      .join(' ')
      .replace(/<[^>]+>/g, '')   // 去除 HTML 标签
      .replace(/&[a-z]+;/gi, '')  // 去除 HTML 实体
      .replace(/[#*_`~\[\]]/g, '')
      .replace(/\n+/g, ' ')
      .slice(0, maxLen);
  }

  function extractCardPreviews(blocks) {
    return blocks
      .filter(b => b.type === 'card' && b.card)
      .map(b => ({
        title: b.card.title || '',
        template_id: b.card.template_id || null,
        components: Array.isArray(b.card.components) ? b.card.components : [],
        styles: b.card.styles || {}
      }));
  }

  // ========== POST /api/explore/posts — 创建帖子 [Auth] ==========

  router.post('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { title, category, content, course_id, expires_at } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '标题为必填项' });
    }

    // content 可以是 JSON 字符串或数组，统一转为字符串存储
    let contentStr = '';
    if (typeof content === 'string') {
      contentStr = content;
    } else if (Array.isArray(content)) {
      contentStr = JSON.stringify(content);
    }

    const validCategories = ['study', 'social', 'trade', 'project', 'general'];
    const cat = validCategories.includes(category) ? category : 'general';

    const result = db.run(
      `INSERT INTO explore_posts (creator_id, title, category, content, course_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title.trim(), cat, contentStr, course_id || null, expires_at || null]
    );
    db.save();

    res.status(201).json({ id: result.lastInsertRowid, message: '发布成功' });
  });

  // ========== GET /api/explore/posts — 帖子列表 [可选Auth] ==========

  router.get('/', optionalAuthMiddleware, (req, res) => {
    const { keyword, category, course_id, creator_id, sort = 'newest', page = 1, pageSize = 20 } = req.query;
    const userId = req.user?.userId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(pageSize);
    const limit = Math.min(50, Math.max(1, parseInt(pageSize)));

    let where = " WHERE ep.status = 'published'";
    const params = [];

    // 搜索关键词（在标题和 content JSON 字符串中搜索）
    if (keyword && keyword.trim()) {
      where += ' AND (ep.title LIKE ? OR ep.content LIKE ?)';
      const kw = `%${keyword.trim()}%`;
      params.push(kw, kw);
    }

    // 分类筛选
    if (category && category !== 'all') {
      where += ' AND ep.category = ?';
      params.push(category);
    }

    // 课程筛选
    if (course_id) {
      where += ' AND ep.course_id = ?';
      params.push(parseInt(course_id));
    }

    // 作者筛选（我的发布）
    if (creator_id) {
      where += ' AND ep.creator_id = ?';
      params.push(parseInt(creator_id));
    }

    // 排序
    let orderBy = ' ORDER BY ep.created_at DESC';
    if (sort === 'popular') orderBy = ' ORDER BY comment_count DESC, ep.created_at DESC';

    // 总数
    const countRow = db.get(`SELECT COUNT(*) AS total FROM explore_posts ep${where}`, params);
    const total = countRow?.total || 0;

    // 查询帖子
    const sql = `
      SELECT ep.*,
        u.username AS creator_name,
        u.nickname AS creator_nickname,
        u.avatar_url AS creator_avatar,
        (SELECT COUNT(*) FROM explore_comments ec WHERE ec.post_id = ep.id) AS comment_count
      FROM explore_posts ep
      LEFT JOIN users u ON u.id = ep.creator_id
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const items = db.all(sql, [...params, limit, offset]);

    // 从 content JSON 提取摘要
    for (const post of items) {
      const blocks = parseContentBlocks(post.content);
      post.text_preview = extractTextPreview(blocks);
      post.card_previews = extractCardPreviews(blocks);
      post.card_count = post.card_previews.length;
      // 不返回完整 content 给列表接口，节省带宽
      delete post.content;
    }

    res.json({ items, total, page: parseInt(page), pageSize: limit });
  });

  // ========== GET /api/explore/posts/:id — 帖子详情 [可选Auth] ==========

  router.get('/:id', optionalAuthMiddleware, (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user?.userId;

    const post = db.get(
      `SELECT ep.*,
        u.username AS creator_name,
        u.nickname AS creator_nickname,
        u.avatar_url AS creator_avatar
       FROM explore_posts ep
       LEFT JOIN users u ON u.id = ep.creator_id
       WHERE ep.id = ?`,
      [postId]
    );

    if (!post) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    // 解析 content blocks
    post.blocks = parseContentBlocks(post.content);
    delete post.content; // 不返回原始字符串

    // 评论数
    post.comment_count = db.get(
      'SELECT COUNT(*) AS cnt FROM explore_comments WHERE post_id = ?',
      [postId]
    )?.cnt || 0;

    res.json(post);
  });

  // ========== PUT /api/explore/posts/:id — 编辑帖子 [Auth, 仅作者] ==========

  router.put('/:id', authMiddleware, (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;

    const post = db.get('SELECT creator_id FROM explore_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id !== userId) return res.status(403).json({ error: '无权编辑' });

    const { title, category, content, course_id, expires_at } = req.body;
    const validCategories = ['study', 'social', 'trade', 'project', 'general'];

    // content 可以是 JSON 字符串或数组
    let contentStr = undefined;
    if (content !== undefined) {
      contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    }

    db.run(
      `UPDATE explore_posts SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        content = COALESCE(?, content),
        course_id = ?,
        expires_at = ?,
        updated_at = datetime('now','localtime')
       WHERE id = ?`,
      [
        title?.trim(),
        validCategories.includes(category) ? category : null,
        contentStr,
        course_id !== undefined ? course_id : undefined,
        expires_at !== undefined ? expires_at : undefined,
        postId
      ]
    );
    db.save();
    res.json({ message: '编辑成功' });
  });

  // ========== DELETE /api/explore/posts/:id — 删除帖子 [Auth, 仅作者] ==========

  router.delete('/:id', authMiddleware, (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;

    const post = db.get('SELECT creator_id FROM explore_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id !== userId) return res.status(403).json({ error: '无权删除' });

    // 删除帖子（评论通过 ON DELETE CASCADE 自动清理）
    db.run('DELETE FROM explore_posts WHERE id = ?', [postId]);
    db.save();

    res.json({ message: '删除成功' });
  });

  return router;
};
