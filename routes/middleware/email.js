const { Resend } = require('resend');

// Resend API Key — 从环境变量读取，测试/开发环境可在 .env 中设置
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

/**
 * 发送邮箱验证码
 * @param {string} toEmail - 接收方邮箱
 * @param {string} code - 6位验证码
 * @returns {object} { success, error? }
 */
async function sendVerificationCode(toEmail, code) {
  // 如果 Resend 未配置，开发模式下返回成功
  if (!resend) {
    console.warn('[Email] Resend API Key 未配置，跳过发送。验证码:', code);
    return { success: true, code };
  }

  // 正式版配置（域名已验证）
  const fromAddress = '课搭子 <noreply@kedazi.top>';
  const finalToEmail = toEmail;

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [finalToEmail], // 这里改用受沙箱保护的测试收件人
      subject: '课搭子 - 邮箱验证码',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:32px;font-family:sans-serif">
          <h2 style="color:#333">课搭子 邮箱验证</h2>
          <p>你的验证码是：</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4A90D9">${code}</span>
          </div>
          <p style="color:#888;font-size:14px">验证码 5 分钟内有效。如果这不是你的操作，请忽略此邮件。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#aaa;font-size:12px">课搭子 · 同课程学习互助平台</p>
        </div>
      `
    });

    if (error) {
      console.error('[Email] 发送失败:', error);
      return { success: false, error: error.message };
    }

    // 日志依然打印前端传过来的真实学号邮箱，方便你调试数据库的匹配情况
    console.log('[Email] 验证码（已转发至测试邮箱）对应目标学号:', toEmail);
    return { success: true };
  } catch (e) {
    console.error('[Email] 发送异常:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { sendVerificationCode };
