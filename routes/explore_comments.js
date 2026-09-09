const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

const COMMENT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'comment-images');
const COMMENT_IMAGE_MAX = 5 * 1024 * 1024; // 5MB
const COMMENT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const COMMENT_COOLDOWN_SECONDS = 30;
const COMMENT_CHAR_LIMIT = 200;

const commentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(COMMENT_IMAGE_DIR, { recursive: true });
      cb(null, COMMENT_IMAGE_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: COMMENT_IMAGE_MAX, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, COMMENT_IMAGE_EXT.has(ext));
  }
});

function parseCommentImage(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  commentUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '图片不能超过 5MB'
      : error.code === 'LIMIT_FILE_COUNT'
        ? '只能上传一张图片'
        : '仅支持 jpg/jpeg/png/webp 格式';
    return res.status(400).json({ error: message });
  });
}

function getRemainingCooldownSeconds(comment) {
  if (!comment?.created_at) return 0;
  const createdAt = new Date(String(comment.created_at).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(createdAt)) return 0;
  const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
  return Math.max(0, COMMENT_COOLDOWN_SECONDS - elapsedSeconds);
}

function getCommentCount(db, postId) {
  return (db.get('SELECT COUNT(*) AS cnt FROM explore_comments WHERE post_id = ?', [postId]) || {}).cnt || 0;
}

function collectDescendantComments(db, commentId) {
  const result = [];
  const stack = [commentId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    const children = db.all('SELECT * FROM explore_comments WHERE parent_id = ?', [currentId]);
    for (const child of children) {
      result.push(child);
      stack.push(child.id);
    }
  }
  return result;
}

function deleteCommentImage(imageUrl) {
  if (!imageUrl) return;
  imageUrl.split(';').filter(Boolean).forEach(url => {
    const imgPath = path.join(__dirname, '..', url);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  });
}

module.exports = function (db) {
  const router = express.Router();

  // GET /api/explore/posts/:postId/comments — 评论列表（游标分页）
  router.get('/:postId/comments', optionalAuthMiddleware, (req, res) => {
    const postId = parseInt(req.params.postId);
    const lastCommentId = req.query.lastCommentId ? parseInt(req.query.lastCommentId) : null;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const userId = req.user?.userId || null;

    // 游标分页查一级评论
    let topComments;
    if (lastCommentId) {
      topComments = db.all(
        `SELECT ec.*, u.nickname AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar, u.grade AS author_grade, u.major AS author_major
         FROM explore_comments ec
         LEFT JOIN users u ON u.id = ec.author_id
         WHERE ec.post_id = ? AND ec.parent_id IS NULL AND ec.id > ?
         ORDER BY ec.id ASC LIMIT ?`,
        [postId, lastCommentId, limit]
      );
    } else {
      topComments = db.all(
        `SELECT ec.*, u.nickname AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar, u.grade AS author_grade, u.major AS author_major
         FROM explore_comments ec
         LEFT JOIN users u ON u.id = ec.author_id
         WHERE ec.post_id = ? AND ec.parent_id IS NULL
         ORDER BY ec.id ASC LIMIT ?`,
        [postId, limit]
      );
    }

    // 为每条一级评论获取最多 3 条二级回复
    const topIds = topComments.map(c => c.id);
    let allChildren = [];
    if (topIds.length > 0) {
      const placeholders = topIds.map(() => '?').join(',');
      allChildren = db.all(
        `SELECT ec.*, u.nickname AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar, u.grade AS author_grade, u.major AS author_major
         FROM explore_comments ec
         LEFT JOIN users u ON u.id = ec.author_id
         WHERE ec.parent_id IN (${placeholders})
         ORDER BY ec.created_at ASC`,
        topIds
      );
    }

    // 按 parent_id 分组，每组最多取 3 条
    const childrenMap = {};
    for (const child of allChildren) {
      const pid = child.parent_id;
      if (!childrenMap[pid]) childrenMap[pid] = [];
      if (childrenMap[pid].length < 3) childrenMap[pid].push(child);
    }

    // 判断是否还有更多二级回复
    const moreCounts = {};
    if (topIds.length > 0) {
      const moreRows = db.all(
        `SELECT parent_id, COUNT(*) AS cnt FROM explore_comments
         WHERE parent_id IN (${topIds.map(() => '?').join(',')})
         GROUP BY parent_id`,
        topIds
      );
      for (const row of moreRows) {
        const visible = (childrenMap[row.parent_id] || []).length;
        if (row.cnt > visible) moreCounts[row.parent_id] = row.cnt - visible;
      }
    }

    // 为每条一级评论填充二级回复
    for (const c of topComments) {
      c.replies = childrenMap[c.id] || [];
      c.reply_count = moreCounts[c.id] ? 3 + moreCounts[c.id] : (childrenMap[c.id] || []).length;
      c.has_more_replies = !!moreCounts[c.id];
      c.more_reply_count = moreCounts[c.id] || 0;
    }

    // 批量查点赞状态
    if (userId && topComments.length > 0) {
      const allIds = [...topComments.map(c => c.id), ...allChildren.map(c => c.id)];
      const likePlaceholders = allIds.map(() => '?').join(',');
      const likedRows = db.all(
        `SELECT comment_id FROM comment_likes WHERE comment_type='explore' AND comment_id IN (${likePlaceholders}) AND user_id = ?`,
        [...allIds, userId]
      );
      const likedSet = new Set(likedRows.map(r => r.comment_id));
      for (const c of topComments) {
        c.is_liked = likedSet.has(c.id);
        c.like_count = c.like_count || 0;
        for (const r of (c.replies || [])) {
          r.is_liked = likedSet.has(r.id);
          r.like_count = r.like_count || 0;
        }
      }
    } else {
      for (const c of topComments) {
        c.like_count = c.like_count || 0;
        c.is_liked = false;
        for (const r of (c.replies || [])) {
          r.like_count = r.like_count || 0;
          r.is_liked = false;
        }
      }
    }

    const totalCommentCount = getCommentCount(db, postId);
    const hasMore = topComments.length === limit && lastCommentId
      ? true
      : topComments.length === limit;

    res.json({
      items: topComments,
      hasMore,
      commentCount: totalCommentCount
    });
  });

  // POST /api/explore/posts/:postId/comments — 发表评论 [Auth]（支持图片 + 楼中楼）
  router.post('/:postId/comments', authMiddleware, parseCommentImage, (req, res) => {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;
    const { content, parent_id } = req.body;
    const imageFile = req.file;

    // 风控：同一用户 30 秒内只能评论一次
    const lastComment = db.get(
      'SELECT MAX(created_at) as last_time FROM explore_comments WHERE author_id = ?',
      [userId]
    );
    if (lastComment?.last_time) {
      const elapsed = Date.now() - new Date(lastComment.last_time).getTime();
      if (elapsed < 30000) {
        if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
        return res.status(429).json({
          error: `评论发送太频繁，请 ${Math.ceil((30000 - elapsed) / 1000)} 秒后再试`,
          retryAfter: Math.ceil((30000 - elapsed) / 1000)
        });
      }
    }

    // 至少需要文字或图片
    if ((!content || !content.trim()) && !imageFile) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '请输入内容或上传图片' });
    }

    // 字数限制
    if (content && content.length > COMMENT_CHAR_LIMIT) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: `评论内容不能超过 ${COMMENT_CHAR_LIMIT} 字` });
    }

    const post = db.get('SELECT id, creator_id, title FROM explore_posts WHERE id = ?', [postId]);
    if (!post) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(404).json({ error: '帖子不存在' });
    }

    // 楼中楼：校验 parent_id
    let parentId = null;
    if (parent_id) {
      parentId = Number(parent_id);
      const parentComment = db.get('SELECT id, author_id FROM explore_comments WHERE id = ? AND post_id = ?', [parentId, postId]);
      if (!parentComment) {
        if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
        return res.status(400).json({ error: '被回复的评论不存在' });
      }
    }

    const imageUrl = imageFile ? `/uploads/comment-images/${imageFile.filename}` : '';

    const result = db.run(
      'INSERT INTO explore_comments (post_id, author_id, content, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [postId, userId, (content || '').trim(), parentId, imageUrl]
    );
    const commentId = result.lastInsertRowid;

    // 通知
    const user = db.get('SELECT nickname, username FROM users WHERE id = ?', [userId]);
    const userName = user?.nickname || user?.username || '某用户';

    if (parentId) {
      const parentComment = db.get('SELECT author_id FROM explore_comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.author_id !== userId) {
        createNotification(db, {
          userId: parentComment.author_id,
          type: 'comment_reply',
          title: '评论回复',
          message: `${userName} 回复了你在「${post.title}」下的评论`,
          relatedType: 'explore_post',
          relatedId: postId,
          relatedCommentId: commentId
        });
      }
    } else {
      if (post.creator_id !== userId) {
        createNotification(db, {
          userId: post.creator_id,
          type: 'post_comment',
          title: '新评论',
          message: `${userName} 评论了你的帖子「${post.title}」`,
          relatedType: 'explore_post',
          relatedId: postId,
          relatedCommentId: commentId
        });
      }
    }

    // @提及解析：从评论内容中提取 @username，创建通知
    if (content) {
      const mentionedNames = [...new Set((content.match(/@(\w+)/g) || []).map(m => m.slice(1)))];
      if (mentionedNames.length > 0) {
        const mentionedUsers = db.all(
          `SELECT id, username FROM users WHERE username IN (${mentionedNames.map(() => '?').join(',')})`,
          mentionedNames
        );
        const parentAuthorId = parentId
          ? (db.get('SELECT author_id FROM explore_comments WHERE id = ?', [parentId]) || {}).author_id
          : null;
        // 已通知过的人（post creator 或 parent author）不再重复通知
        const alreadyNotified = new Set([userId, post.creator_id, parentAuthorId].filter(Boolean));
        for (const mentioned of mentionedUsers) {
          if (!alreadyNotified.has(mentioned.id)) {
            createNotification(db, {
              userId: mentioned.id,
              type: 'comment_mention',
              title: '有人@了你',
              message: `${userName} 在评论中@了你`,
              relatedType: 'explore_post',
              relatedId: postId,
              relatedCommentId: commentId
            });
          }
        }
      }
    }

    db.save();

    // 返回完整评论
    const comment = db.get(
      `SELECT ec.*,
        u.nickname AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM explore_comments ec
       LEFT JOIN users u ON u.id = ec.author_id
       WHERE ec.id = ?`,
      [commentId]
    );
    res.status(201).json(comment);
  });

  // DELETE /api/explore/posts/:postId/comments/:commentId — 删除评论 [Auth, 仅作者]（硬删除）
  router.delete('/:postId/comments/:commentId', authMiddleware, (req, res) => {
    const postId = parseInt(req.params.postId);
    const commentId = parseInt(req.params.commentId);
    const userId = req.user.userId;

    const comment = db.get('SELECT * FROM explore_comments WHERE id = ? AND post_id = ?', [commentId, postId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '只能删除自己的评论' });

    // 删除图片文件
    const descendants = collectDescendantComments(db, commentId);
    [comment, ...descendants].forEach(c => deleteCommentImage(c.image_url));

    // 硬删除（先清理 likes 再清理评论）
    const ids = [commentId, ...descendants.map(c => c.id)];
    const idPlaceholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM comment_likes WHERE comment_type='explore' AND comment_id IN (${idPlaceholders})`, ids);
    for (const id of ids) db.run('DELETE FROM explore_comments WHERE id = ?', [id]);
    db.save();

    res.json({ message: '已删除', deleted_count: ids.length, comment_count: getCommentCount(db, postId) });
  });

  // POST /api/explore/posts/:postId/comments/:commentId/like — 点赞 [Auth]
  router.post('/:postId/comments/:commentId/like', authMiddleware, (req, res) => {
    const commentId = parseInt(req.params.commentId);
    const userId = req.user.userId;

    const comment = db.get('SELECT id, like_count FROM explore_comments WHERE id = ?', [commentId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });

    try {
      db.run("INSERT INTO comment_likes (comment_type, comment_id, user_id) VALUES ('explore', ?, ?)", [commentId, userId]);
    } catch {
      return res.status(409).json({ error: '已点赞' });
    }
    db.run('UPDATE explore_comments SET like_count = like_count + 1 WHERE id = ?', [commentId]);
    db.save();

    const updated = db.get('SELECT like_count FROM explore_comments WHERE id = ?', [commentId]);
    res.json({ liked: true, like_count: updated?.like_count || 1 });
  });

  // DELETE /api/explore/posts/:postId/comments/:commentId/like — 取消点赞 [Auth]
  router.delete('/:postId/comments/:commentId/like', authMiddleware, (req, res) => {
    const commentId = parseInt(req.params.commentId);
    const userId = req.user.userId;

    const existing = db.get("SELECT id FROM comment_likes WHERE comment_type='explore' AND comment_id = ? AND user_id = ?", [commentId, userId]);
    if (!existing) return res.status(404).json({ error: '未点赞' });

    db.run("DELETE FROM comment_likes WHERE comment_type='explore' AND comment_id = ? AND user_id = ?", [commentId, userId]);
    db.run('UPDATE explore_comments SET like_count = MAX(0, like_count - 1) WHERE id = ?', [commentId]);
    db.save();

    const updated = db.get('SELECT like_count FROM explore_comments WHERE id = ?', [commentId]);
    res.json({ liked: false, like_count: updated?.like_count || 0 });
  });

  // GET /api/explore/posts/:postId/comments/:commentId/replies — 获取楼中楼回复
  router.get('/:postId/comments/:commentId/replies', optionalAuthMiddleware, (req, res) => {
    const commentId = parseInt(req.params.commentId);
    const userId = req.user?.userId || null;
    const replies = db.all(
      `SELECT ec.*, u.nickname AS author_name, u.username AS author_username,
              u.avatar_url AS author_avatar_url, u.grade AS author_grade, u.major AS author_major
       FROM explore_comments ec
       JOIN users u ON ec.author_id = u.id
       WHERE ec.parent_id = ?
       ORDER BY ec.created_at ASC`,
      [commentId]
    );
    // 附上点赞状态
    if (userId && replies.length > 0) {
      const ids = replies.map(r => r.id);
      const likedRows = db.all(
        `SELECT comment_id FROM comment_likes WHERE comment_type='explore' AND comment_id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
        [...ids, userId]
      );
      const likedSet = new Set(likedRows.map(r => r.comment_id));
      for (const r of replies) {
        r.is_liked = likedSet.has(r.id);
        r.like_count = r.like_count || 0;
      }
    } else {
      for (const r of replies) {
        r.like_count = r.like_count || 0;
        r.is_liked = false;
      }
    }
    res.json(replies);
  });

  return router;
};
