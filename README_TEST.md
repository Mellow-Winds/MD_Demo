# 开发环境搭建指南

## 第一步：克隆仓库

打开终端，执行：

```bash
git clone https://github.com/Mellow-Winds/LessonHelper.git
cd LessonHelper
```

## 第二步：创建 .env 文件

在项目根目录下新建一个名为 `.env` 的文件（注意，文件名就是 `.env`，没有后缀），写入以下内容：

```env
# JWT 认证
JWT_SECRET=把这里替换成你生成的密钥

# 邮件服务（测试环境可不填）
RESEND_API_KEY=

# Cloudflare Turnstile — 测试密钥，本地开发直接用
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

## 第三步：生成 JWT 密钥

终端执行：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

会输出一串 64 位的随机字符，比如 `a1b2c3d4e5f6...`。把它复制下来，替换 `.env` 文件第一行的 `把这里替换成你生成的密钥`。

> **JWT 密钥每人自己生成，不要共享。** 它是用来签发登录凭证的，泄露后别人可以伪造你的用户身份。

## 第四步：安装依赖

```bash
npm install
```

## 第五步：启动

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`，搞定。

注册试试：填学号+密码 → 点 Turnstile → 提交 → 直接进主页。
