const jwt = require('jsonwebtoken');

// JWT Secret — 从环境变量读取；详见 .env 配置
const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_EXPIRY = '7d';

// 生成 Token
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// 验证中间件
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, username }
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// 公开接口可以识别已登录用户，但不会强制要求登录。
function optionalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    // 无效 token 按未登录处理，公开内容仍可访问。
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware, generateToken, JWT_SECRET };
