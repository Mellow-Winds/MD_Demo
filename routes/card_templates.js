const express = require('express');
const { authMiddleware } = require('./middleware/auth');

// Valid categories
const VALID_CATEGORIES = ['study', 'social', 'trade', 'project', 'general'];
// Valid atomic module types
const VALID_MODULE_TYPES = ['input', 'link', 'contact', 'price', 'tags', 'vote', 'timer', 'days_matter'];
// Icon format regex
const ICON_RE = /^(ri-|mi-)[a-z0-9-]+$/;
// Hex color regex
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

module.exports = function (db) {
  const router = express.Router();

  // ========== 辅助函数 ==========

  function formatTemplate(t) {
    let components_schema = [];
    try { components_schema = JSON.parse(t.components_schema); } catch (e) { /* ignore */ }
    let styles = {};
    try { styles = JSON.parse(t.styles || '{}'); } catch (e) { /* ignore */ }
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      components_schema,
      styles,
      is_official: t.is_official,
      creator_id: t.creator_id,
      creator_name: t.creator_name || null,
      usage_count: t.usage_count,
      created_at: t.created_at
    };
  }

  function validateTemplateBody(body, isUpdate = false) {
    const errors = [];

    if (!isUpdate || body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) errors.push('名称不能为空');
      else if (body.name.trim().length > 20) errors.push('名称最多20个字符');
    }
    if (!isUpdate || body.description !== undefined) {
      if (!body.description || body.description.trim().length === 0) errors.push('描述不能为空');
      else if (body.description.trim().length > 80) errors.push('描述最多80个字符');
    }
    if (!isUpdate || body.icon !== undefined) {
      if (!body.icon || !ICON_RE.test(body.icon)) errors.push('图标格式无效（需 ri-* 或 mi-*）');
    }
    if (!isUpdate || body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(body.category)) errors.push('分类无效');
    }
    if (!isUpdate || body.components_schema !== undefined) {
      if (!Array.isArray(body.components_schema)) errors.push('模块配置必须是数组');
      else if (body.components_schema.length < 1 || body.components_schema.length > 8) errors.push('模块数量需在1-8之间');
      else {
        for (let i = 0; i < body.components_schema.length; i++) {
          const comp = body.components_schema[i];
          if (!VALID_MODULE_TYPES.includes(comp.type)) errors.push(`模块${i + 1}的类型无效`);
          if (!comp.label || comp.label.trim().length === 0) errors.push(`模块${i + 1}的标签不能为空`);
        }
      }
    }
    if (body.styles !== undefined) {
      if (typeof body.styles !== 'object') errors.push('styles必须是对象');
      else {
        if (body.styles.bg && !HEX_RE.test(body.styles.bg)) errors.push('背景色格式无效');
        if (body.styles.accent && !HEX_RE.test(body.styles.accent)) errors.push('强调色格式无效');
      }
    }

    return errors;
  }

  // ========== 公开接口 ==========

  // GET /api/card-templates — 模板列表
  router.get('/', (req, res) => {
    const { category, is_official, creator_id } = req.query;

    let sql = `SELECT ct.*, u.nickname AS creator_name
      FROM card_templates ct
      LEFT JOIN users u ON ct.creator_id = u.id`;
    const clauses = [];
    const params = [];

    if (category && category !== 'all') {
      clauses.push('ct.category = ?');
      params.push(category);
    }
    if (is_official !== undefined) {
      clauses.push('ct.is_official = ?');
      params.push(Number(is_official));
    }
    if (creator_id === 'me') {
      // Requires auth — handled as a special case below
    } else if (creator_id) {
      clauses.push('ct.creator_id = ?');
      params.push(Number(creator_id));
    }

    if (clauses.length > 0) {
      sql += ' WHERE ' + clauses.join(' AND ');
    }

    // Handle creator_id=me (requires auth)
    if (creator_id === 'me') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '请先登录' });
      }
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || '');
        const prefix = clauses.length > 0 ? ' AND ' : ' WHERE ';
        sql += prefix + 'ct.creator_id = ?';
        params.push(decoded.userId);
      } catch (e) {
        return res.status(401).json({ error: '登录已过期' });
      }
    }

    sql += ' ORDER BY ct.is_official DESC, ct.usage_count DESC';

    const templates = db.all(sql, params).map(formatTemplate);
    res.json(templates);
  });

  // GET /api/card-templates/:id — 模板详情
  router.get('/:id', (req, res) => {
    const template = db.get(
      `SELECT ct.*, u.nickname AS creator_name
       FROM card_templates ct
       LEFT JOIN users u ON ct.creator_id = u.id
       WHERE ct.id = ?`,
      [req.params.id]
    );
    if (!template) return res.status(404).json({ error: '模板不存在' });

    res.json(formatTemplate(template));
  });

  // ========== 需认证接口 ==========

  // POST /api/card-templates — 创建 UGC 模板
  router.post('/', authMiddleware, (req, res) => {
    const body = req.body;
    const errors = validateTemplateBody(body);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('；') });

    const id = `ugc_${req.user.userId}_${Date.now()}`;
    const name = body.name.trim();
    const description = body.description.trim();
    const icon = body.icon;
    const category = body.category;
    const components_schema = JSON.stringify(body.components_schema);
    const styles = JSON.stringify(body.styles || {});

    db.run(
      `INSERT INTO card_templates (id, name, description, icon, category, components_schema, is_official, creator_id, styles)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, name, description, icon, category, components_schema, req.user.userId, styles]
    );

    const template = db.get(
      `SELECT ct.*, u.nickname AS creator_name
       FROM card_templates ct
       LEFT JOIN users u ON ct.creator_id = u.id
       WHERE ct.id = ?`,
      [id]
    );

    res.status(201).json(formatTemplate(template));
  });

  // PUT /api/card-templates/:id — 编辑自己的模板
  router.put('/:id', authMiddleware, (req, res) => {
    const template = db.get('SELECT * FROM card_templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: '模板不存在' });
    if (template.is_official) return res.status(403).json({ error: '不能编辑官方模板' });
    if (template.creator_id !== req.user.userId) return res.status(403).json({ error: '无权编辑此模板' });

    const body = req.body;
    const errors = validateTemplateBody(body, true);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('；') });

    const sets = [];
    const params = [];

    if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name.trim()); }
    if (body.description !== undefined) { sets.push('description = ?'); params.push(body.description.trim()); }
    if (body.icon !== undefined) { sets.push('icon = ?'); params.push(body.icon); }
    if (body.category !== undefined) { sets.push('category = ?'); params.push(body.category); }
    if (body.components_schema !== undefined) { sets.push('components_schema = ?'); params.push(JSON.stringify(body.components_schema)); }
    if (body.styles !== undefined) { sets.push('styles = ?'); params.push(JSON.stringify(body.styles)); }

    if (sets.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.run(`UPDATE card_templates SET ${sets.join(', ')} WHERE id = ?`, params);

    const updated = db.get(
      `SELECT ct.*, u.nickname AS creator_name
       FROM card_templates ct
       LEFT JOIN users u ON ct.creator_id = u.id
       WHERE ct.id = ?`,
      [req.params.id]
    );

    res.json(formatTemplate(updated));
  });

  // DELETE /api/card-templates/:id — 删除自己的模板
  router.delete('/:id', authMiddleware, (req, res) => {
    const template = db.get('SELECT * FROM card_templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: '模板不存在' });
    if (template.is_official) return res.status(403).json({ error: '不能删除官方模板' });
    if (template.creator_id !== req.user.userId) return res.status(403).json({ error: '无权删除此模板' });

    // Nullify template_id references in explore_cards that used this template
    db.run('UPDATE explore_cards SET template_id = NULL WHERE template_id = ?', [req.params.id]);
    db.run('DELETE FROM card_templates WHERE id = ?', [req.params.id]);

    res.json({ message: '已删除' });
  });

  return router;
};
