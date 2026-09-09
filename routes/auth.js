const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, generateToken } = require('./middleware/auth');
const { sendVerificationCode } = require('./middleware/email');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
const AVATAR_MAX = 2 * 1024 * 1024;
const AVATAR_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
      cb(null, AVATAR_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `av_${req.user.userId}_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: AVATAR_MAX, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // 双重校验：MIME 类型 + 扩展名
    if (!AVATAR_MIME.has(file.mimetype) || !AVATAR_EXT.has(ext)) {
      return cb(new Error('AVATAR_FORMAT'));
    }
    cb(null, true);
  }
});

const SALT_ROUNDS = 10;
const CODE_EXPIRY_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 3;

// Turnstile Secret Key — 从环境变量读取；详见 .env 中的测试/正式密钥说明
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';

// 简单内存限流（生产环境建议用 Redis）
const rateLimitMap = new Map();

module.exports = function (db) {
  const router = express.Router();

  // ========== 工具函数 ==========

  // 学号格式验证（3种正则）
  function validateStudentId(studentId) {
    if (!studentId) return false;
    // 本科：9位纯数字
    if (/^\d{9}$/.test(studentId)) return true;
    // 研究生（2022+）：12位纯数字
    if (/^\d{12}$/.test(studentId)) return true;
    // 研究生（2021-）：MG/MF/BH开头 + 8位数字
    if (/^(MG|MF|BH)\d{8}$/.test(studentId)) return true;
    return false;
  }

  // 密码规范验证（30位以内，仅大小写字母和数字）
  function validatePassword(password) {
    if (!password || password.length < 8 || password.length > 30) return false;
    if (!/^[a-zA-Z0-9]+$/.test(password)) return false;
    // 必须包含大小写字母和数字
    return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
  }

  // 生成6位数字验证码
  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function isExpiredDate(value) {
    if (!value) return true;
    const text = String(value);
    const normalized = text.includes('T') ? text : `${text.replace(' ', 'T')}Z`;
    const timestamp = Date.parse(normalized);
    if (Number.isNaN(timestamp)) return true;
    return timestamp < Date.now();
  }

  // 生成默认昵称
  function generateNickname(studentId) {
    if (/^\d{9,12}$/.test(studentId)) {
      return `同学_${studentId.slice(0, 4)}`;
    }
    // 字母开头：同学_MG2021 等
    const match = studentId.match(/^([A-Z]{2})(\d{4})/);
    if (match) {
      return `同学_${match[1]}${match[2]}`;
    }
    return `同学_${studentId.slice(0, 6)}`;
  }

  // 限流检查（60秒冷却 + 每天最多5次）
  function checkRateLimit(email) {
    const now = Date.now();
    const key = `rate_${email}`;

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { lastSent: 0, dailyCount: 0, dailyDate: '' });
    }

    const record = rateLimitMap.get(key);
    const today = new Date().toISOString().slice(0, 10);

    // 重置每日计数
    if (record.dailyDate !== today) {
      record.dailyDate = today;
      record.dailyCount = 0;
    }

    // 60秒冷却检查
    if (now - record.lastSent < 60000) {
      return { ok: false, error: '验证码发送过于频繁，请60秒后重试' };
    }

    // 每天最多5次
    if (record.dailyCount >= 5) {
      return { ok: false, error: '今日验证码发送次数已达上限，请明天再试' };
    }

    return { ok: true, record };
  }

  // 更新限流记录
  function updateRateLimit(email) {
    const key = `rate_${email}`;
    const record = rateLimitMap.get(key);
    if (record) {
      record.lastSent = Date.now();
      record.dailyCount += 1;
    }
  }

  // 清理过期验证码
  function cleanExpiredVerifications() {
    try {
      db.run("DELETE FROM email_verifications WHERE expires_at < datetime('now')");
      db.save();
    } catch (e) {
      console.error('[Auth] 清理过期验证码失败:', e.message);
    }
  }

  // Cloudflare Turnstile 验证
  async function verifyTurnstile(token, ip) {
    // 如果 Secret Key 未配置（环境变量未设置），返回失败
    if (!TURNSTILE_SECRET_KEY) {
      console.error('[Auth] Turnstile Secret Key 未配置');
      return { ok: false, error: '系统出现未知错误，请在看到此消息后及时反馈' };
    }

    // 测试密钥：跳过 Cloudflare API 调用，直接放行（便于本地开发）
    if (TURNSTILE_SECRET_KEY === '1x0000000000000000000000000000000AA') {
      console.log('[Auth] Turnstile 测试密钥，跳过云端验证');
      return { ok: true };
    }


    try {
      const formData = new URLSearchParams();
      formData.append('secret', TURNSTILE_SECRET_KEY);
      formData.append('response', token);
      if (ip) formData.append('remoteip', ip);

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        console.error('[Auth] Turnstile 验证失败:', JSON.stringify(data));
        return { ok: false, error: '系统出现未知错误，请在看到此消息后及时反馈' };
      }

      return { ok: true };
    } catch (e) {
      console.error('[Auth] Turnstile 请求异常:', e.message);
      return { ok: false, error: '系统出现未知错误，请在看到此消息后及时反馈' };
    }
  }

  // 获取客户端 IP
  function getClientIp(req) {
    return req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || '';
  }

  // ========== API 路由 ==========

  // POST /api/auth/register — 注册（发送验证码）
  router.post('/register', async (req, res) => {
    try {
      const { studentId, password, confirmPassword, turnstileToken, honeypot } = req.body;

      // 蜜罐检测：如果被填了，伪造成功响应
      if (honeypot) {
        return res.json({ message: '验证码已发送' });
      }

      // 参数校验
      if (!studentId || !password || !confirmPassword) {
        return res.status(400).json({ error: '请填写完整信息' });
      }

      // 学号格式验证
      if (!validateStudentId(studentId)) {
        return res.status(400).json({ error: '学号格式不正确' });
      }

      // 密码规范验证
      if (!validatePassword(password)) {
        return res.status(400).json({ error: '密码须为1-30位，仅包含大小写字母和数字' });
      }

      // 确认密码一致性
      if (password !== confirmPassword) {
        return res.status(400).json({ error: '两次输入的密码不一致' });
      }

      // 拼接邮箱
      const email = `${studentId}@smail.nju.edu.cn`;

      // 查重拦截
      const existingUser = db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(409).json({ error: '该学号已注册，请直接登录' });
      }

      // Turnstile 验证
      if (!turnstileToken) {
        return res.status(400).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
      }

      const clientIp = getClientIp(req);
      const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
      if (!turnstileResult.ok) {
        return res.status(403).json({ error: turnstileResult.error });
      }

      // 测试密钥：跳过邮件验证码，直接创建用户并返回 token
      if (TURNSTILE_SECRET_KEY === '1x0000000000000000000000000000000AA') {
        const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
        const nickname = generateNickname(studentId);
        const username = email;

        db.run(
          `INSERT INTO users (username, display_name, email, password_hash, nickname, email_verified)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [username, nickname, email, passwordHash, nickname]
        );
        db.save();

        const newUser = db.get('SELECT * FROM users WHERE email = ?', [email]);
        const token = generateToken(newUser);
        const { password_hash, ...safeUser } = newUser;

        console.log(`[Auth] 测试密钥注册成功（跳过邮件验证）: ${email}`);
        return res.status(201).json({ token, user: safeUser });
      }


      // 限流检查
      const rateLimitResult = checkRateLimit(email);
      if (!rateLimitResult.ok) {
        return res.status(429).json({ error: rateLimitResult.error });
      }

      // 生成验证码
      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

      // 写入验证码表（UPSERT）
      db.run(
        `INSERT INTO email_verifications (email, code, attempts, expires_at)
         VALUES (?, ?, 0, ?)
         ON CONFLICT(email) DO UPDATE SET code = ?, attempts = 0, expires_at = ?, created_at = CURRENT_TIMESTAMP`,
        [email, code, expiresAt, code, expiresAt]
      );
      db.save();

      // 更新限流记录
      updateRateLimit(email);

      // 异步清理过期验证码
      cleanExpiredVerifications();

      // 发送邮件
      const sendResult = await sendVerificationCode(email, code);
      if (!sendResult.success) {
        return res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
      }

      console.log(`[Auth] 注册验证码已发送: ${email}`);
      res.status(201).json({ message: '验证码已发送至你的学号邮箱' });

    } catch (e) {
      console.error('[Auth] 注册失败:', e);
      res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
    }
  });

  // POST /api/auth/verify-email — 验证邮箱（完成注册）
  router.post('/verify-email', async (req, res) => {
    try {
      const { studentId, code, password } = req.body;

      if (!studentId || !code || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
      }

      const email = `${studentId}@smail.nju.edu.cn`;

      // 查询验证码记录
      const record = db.get('SELECT * FROM email_verifications WHERE email = ?', [email]);

      if (!record) {
        return res.status(400).json({ error: '验证码已过期，请重新获取' });
      }

      // 检查过期
      if (new Date(record.expires_at) < new Date()) {
        db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
        db.save();
        return res.status(400).json({ error: '验证码已过期，请重新获取' });
      }

      // 检查错误次数（3次销毁）
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
        db.save();
        return res.status(400).json({ error: '验证码输入错误次数过多，请重新获取' });
      }

      // 验证码比对
      if (record.code !== code) {
        // 增加错误计数
        db.run('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?', [email]);
        db.save();

        const remaining = MAX_VERIFY_ATTEMPTS - record.attempts - 1;
        if (remaining <= 0) {
          db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
          db.save();
          return res.status(400).json({ error: '验证码输入错误次数过多，请重新获取' });
        }
        return res.status(400).json({ error: `验证码错误，还可尝试${remaining}次` });
      }

      // 验证码正确，创建用户
      const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
      const nickname = generateNickname(studentId);
      const username = email; // username = 邮箱

      db.run(
        `INSERT INTO users (username, display_name, email, password_hash, nickname, email_verified)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [username, nickname, email, passwordHash, nickname]
      );
      db.save();

      // 删除验证码记录
      db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
      db.save();

      // 查询新用户
      const newUser = db.get('SELECT * FROM users WHERE email = ?', [email]);
      const token = generateToken(newUser);
      const { password_hash, ...safeUser } = newUser;

      console.log(`[Auth] 注册成功: ${email}`);
      res.json({ token, user: safeUser });

    } catch (e) {
      console.error('[Auth] 验证失败:', e);
      res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
    }
  });

  // POST /api/auth/login — 登录
  router.post('/login', async (req, res) => {
    try {
      const { studentId, password, turnstileToken } = req.body;

      // Turnstile 人机验证
      if (!turnstileToken) {
        return res.status(400).json({ error: '人机验证未完成' });
      }
      const clientIp = getClientIp(req);
      const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
      if (!turnstileResult.ok) {
        return res.status(403).json({ error: turnstileResult.error });
      }

      if (!studentId || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
      }

      // 学号格式验证
      if (!validateStudentId(studentId)) {
        return res.status(400).json({ error: '学号格式不正确' });
      }

      // 密码规范验证
      if (!validatePassword(password)) {
        return res.status(400).json({ error: '密码格式不正确' });
      }

      const email = `${studentId}@smail.nju.edu.cn`;
      const user = db.get('SELECT * FROM users WHERE email = ?', [email]);

      // 模糊错误消息：不暴露账号是否存在
      if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: '账号或密码错误' });
      }

      const token = generateToken(user);
      const { password_hash, ...safeUser } = user;

      console.log(`[Auth] 登录成功: ${email}`);
      res.json({ token, user: safeUser });

    } catch (e) {
      console.error('[Auth] 登录失败:', e);
      res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
    }
  });

  // POST /api/auth/resend-code — 重新发送验证码
  router.post('/forgot-password', async (req, res) => {
    try {
      const { studentId, turnstileToken } = req.body;
      if (!studentId) return res.status(400).json({ error: '请填写学号' });
      if (!validateStudentId(studentId)) return res.status(400).json({ error: '学号格式不正确' });

      const email = `${studentId}@smail.nju.edu.cn`;
      const user = db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (!user) return res.status(404).json({ error: '该学号尚未注册' });

      // Turnstile 验证
      if (!turnstileToken) {
        return res.status(400).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
      }

      const clientIp = getClientIp(req);
      const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
      if (!turnstileResult.ok) {
        return res.status(403).json({ error: turnstileResult.error });
      }

      const rateLimitResult = checkRateLimit(email);
      if (!rateLimitResult.ok) return res.status(429).json({ error: rateLimitResult.error });

      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
      db.run(
        `INSERT INTO email_verifications (email, code, attempts, expires_at)
         VALUES (?, ?, 0, ?)
         ON CONFLICT(email) DO UPDATE SET code = ?, attempts = 0, expires_at = ?, created_at = CURRENT_TIMESTAMP`,
        [email, code, expiresAt, code, expiresAt]
      );
      db.save();
      updateRateLimit(email);
      cleanExpiredVerifications();

      if (process.env.NODE_ENV !== 'test') {
        const sendResult = await sendVerificationCode(email, code);
        if (!sendResult.success) {
          return res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
        }
      }

      res.json({ message: '验证码已发送至你的学号邮箱' });
    } catch (e) {
      console.error('[Auth] forgot password failed:', e);
      res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
    }
  });

  router.post('/reset-password', async (req, res) => {
    try {
      const { studentId, code, password, confirmPassword } = req.body;
      if (!studentId || !code || !password || !confirmPassword) {
        return res.status(400).json({ error: '请填写完整信息' });
      }
      if (!validateStudentId(studentId)) return res.status(400).json({ error: '学号格式不正确' });
      if (!validatePassword(password)) {
        return res.status(400).json({ error: '密码须为8-30位，且包含大小写字母和数字' });
      }
      if (password !== confirmPassword) return res.status(400).json({ error: '两次输入的密码不一致' });

      const email = `${studentId}@smail.nju.edu.cn`;
      const user = db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (!user) return res.status(404).json({ error: '该学号尚未注册' });

      const record = db.get('SELECT * FROM email_verifications WHERE email = ?', [email]);
      if (!record) return res.status(400).json({ error: '验证码已过期，请重新获取' });
      if (isExpiredDate(record.expires_at)) {
        db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
        db.save();
        return res.status(400).json({ error: '验证码已过期，请重新获取' });
      }
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
        db.save();
        return res.status(400).json({ error: '验证码输入错误次数过多，请重新获取' });
      }
      if (record.code !== code) {
        db.run('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?', [email]);
        db.save();
        const remaining = MAX_VERIFY_ATTEMPTS - record.attempts - 1;
        if (remaining <= 0) {
          db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
          db.save();
          return res.status(400).json({ error: '验证码输入错误次数过多，请重新获取' });
        }
        return res.status(400).json({ error: `验证码错误，还可尝试${remaining}次` });
      }

      const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
      db.run('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);
      db.run('DELETE FROM email_verifications WHERE email = ?', [email]);
      db.save();
      res.json({ message: '密码已重置，请使用新密码登录' });
    } catch (e) {
      console.error('[Auth] reset password failed:', e);
      res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
    }
  });

  router.post('/resend-code', async (req, res) => {
    try {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ error: '请填写学号' });
      }

      if (!validateStudentId(studentId)) {
        return res.status(400).json({ error: '学号格式不正确' });
      }

      const email = `${studentId}@smail.nju.edu.cn`;

      // 检查是否已有验证码记录
      const existing = db.get('SELECT * FROM email_verifications WHERE email = ?', [email]);
      if (!existing) {
        return res.status(400).json({ error: '请先获取验证码' });
      }

      // 限流检查
      const rateLimitResult = checkRateLimit(email);
      if (!rateLimitResult.ok) {
        return res.status(429).json({ error: rateLimitResult.error });
      }

      // 生成新验证码
      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

      db.run(
        'UPDATE email_verifications SET code = ?, attempts = 0, expires_at = ? WHERE email = ?',
        [code, expiresAt, email]
      );
      db.save();

      // 更新限流记录
      updateRateLimit(email);

      // 发送邮件
      const sendResult = await sendVerificationCode(email, code);
      if (!sendResult.success) {
        return res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
      }

      console.log(`[Auth] 验证码已重新发送: ${email}`);
      res.json({ message: '验证码已重新发送' });

    } catch (e) {
      console.error('[Auth] 重发失败:', e);
      res.status(500).json({ error: '系统出现未知错误，请在看到此消息后及时反馈' });
    }
  });

  // GET /api/auth/me — 获取当前用户信息（保留）
  router.get('/me', authMiddleware, (req, res) => {
    const user = db.get(
      'SELECT id, username, email, nickname, major, grade, avatar_url, qq, wechat, douyin, avatar_desc, mbti, gender, checkin_streak, last_checkin_date, grace_days, privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
  });

  // PUT /api/auth/me — 更新个人信息（保留）
  router.put('/me', authMiddleware, (req, res) => {
    const { nickname, major, grade, avatar_url, qq, wechat, douyin, avatar_desc, mbti, gender, privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers } = req.body;
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证 avatar_desc 长度
    if (avatar_desc !== undefined && avatar_desc.length > 80) {
      return res.status(400).json({ error: '肖像描述不能超过80字' });
    }

    // 验证 mbti 选项
    const validMbti = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
    if (mbti !== undefined && mbti !== '' && !validMbti.includes(mbti)) {
      return res.status(400).json({ error: '无效的MBTI人格类型' });
    }

    // 验证 gender 选项
    const validGender = ['', 'male', 'female'];
    if (gender !== undefined && !validGender.includes(gender)) {
      return res.status(400).json({ error: '无效的性别选项' });
    }

    // 如果清空头像（恢复默认），删除旧头像文件
    if (avatar_url === '' && user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(__dirname, '..', user.avatar_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    db.run(
      'UPDATE users SET nickname = ?, major = ?, grade = ?, avatar_url = ?, qq = ?, wechat = ?, douyin = ?, avatar_desc = ?, mbti = ?, gender = ?, privacy_show_profile = ?, privacy_allow_match = ?, privacy_show_following = ?, privacy_show_followers = ? WHERE id = ?',
      [
        nickname !== undefined ? nickname : user.nickname,
        major !== undefined ? major : user.major,
        grade !== undefined ? grade : user.grade,
        avatar_url !== undefined ? avatar_url : user.avatar_url,
        qq !== undefined ? qq : user.qq,
        wechat !== undefined ? wechat : user.wechat,
        douyin !== undefined ? douyin : user.douyin,
        avatar_desc !== undefined ? avatar_desc : user.avatar_desc,
        mbti !== undefined ? mbti : user.mbti,
        gender !== undefined ? gender : user.gender,
        privacy_show_profile !== undefined ? (privacy_show_profile ? 1 : 0) : user.privacy_show_profile,
        privacy_allow_match !== undefined ? (privacy_allow_match ? 1 : 0) : user.privacy_allow_match,
        privacy_show_following !== undefined ? (privacy_show_following ? 1 : 0) : user.privacy_show_following,
        privacy_show_followers !== undefined ? (privacy_show_followers ? 1 : 0) : user.privacy_show_followers,
        req.user.userId
      ]
    );
    db.save();

    const updated = db.get(
      'SELECT id, username, email, nickname, major, grade, avatar_url, qq, wechat, douyin, avatar_desc, mbti, gender, checkin_streak, last_checkin_date, grace_days, privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    res.json(updated);
  });

  // POST /api/auth/checkin — 每日签到（保留）
  router.post('/checkin', authMiddleware, (req, res) => {
    const user = db.get(
      'SELECT id, checkin_streak, last_checkin_date, grace_days FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const today = req.body.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });

    if (user.last_checkin_date === today) {
      return res.json({ streak: user.checkin_streak, alreadyCheckedIn: true });
    }

    let streak = user.checkin_streak || 0;
    let graceDays = user.grace_days || 0;

    const lastDate = user.last_checkin_date ? new Date(user.last_checkin_date) : null;
    const todayDate = new Date(today);
    const daysDiff = lastDate ? Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24)) : 999;

    if (daysDiff === 1) {
      streak += 1;
      graceDays = 0;
    } else if (daysDiff > 1 && streak > 0) {
      if (streak >= 45) {
        if (daysDiff <= 7 + 1) {
          graceDays = 0;
          streak += 1;
        } else {
          streak = 1;
          graceDays = 0;
        }
      } else if (streak >= 7) {
        if (daysDiff <= 3 + 1) {
          graceDays = 0;
          streak += 1;
        } else {
          streak = 1;
          graceDays = 0;
        }
      } else {
        streak = 1;
        graceDays = 0;
      }
    } else if (daysDiff > 1) {
      streak = 1;
      graceDays = 0;
    }

    db.run(
      'UPDATE users SET checkin_streak = ?, last_checkin_date = ?, grace_days = ? WHERE id = ?',
      [streak, today, graceDays, req.user.userId]
    );
    db.save();

    res.json({ streak, alreadyCheckedIn: false });
  });

  // POST /api/auth/avatar — 上传头像 [Auth]（前端已完成三级压缩，后端直接存盘）
  router.post('/avatar', authMiddleware, (req, res) => {
    avatarUpload.single('avatar')(req, res, async (error) => {
      if (error) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? '头像不能超过 2MB'
          : error.message === 'AVATAR_FORMAT'
            ? '仅支持 jpg/jpeg/png/gif/webp 格式'
            : '仅支持 jpg/jpeg/png/gif/webp 格式';
        return res.status(400).json({ error: message });
      }

      if (!req.file) {
        return res.status(400).json({ error: '请选择图片文件' });
      }

      const originalPath = req.file.path;
      // 统一输出为 .jpg（前端已保证 JPEG 格式，后端做兜底重命名）
      const ext = path.extname(req.file.originalname).toLowerCase();
      const jpgExts = new Set(['.jpg', '.jpeg']);
      const outputFilename = jpgExts.has(ext)
        ? path.basename(req.file.filename)
        : req.file.filename.replace(ext, '.jpg');
      const outputPath = path.join(AVATAR_DIR, outputFilename);

      // 如果需要重命名
      if (outputPath !== originalPath) {
        fs.renameSync(originalPath, outputPath);
      }

      const avatarUrl = `/uploads/avatars/${outputFilename}`;

      try {
        // 删除旧头像文件（如果有的话）
        const user = db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.userId]);
        if (user?.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
          const oldPath = path.join(__dirname, '..', user.avatar_url);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.userId]);
        db.save();

        res.json({ avatar_url: avatarUrl, message: '头像已更新' });
      } catch (err) {
        // 清理残留文件
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        console.error('Avatar save error:', err);
        res.status(500).json({ error: '头像保存失败，请重试' });
      }
    });
  });

  return router;
};
