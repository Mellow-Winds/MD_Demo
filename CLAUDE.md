# CLAUDE.md — 课搭子 项目指南

## 项目概述

**课搭子**（LessonHelper）是一个面向大学生的同课程学习互助平台。核心功能包括：用户系统、课程管理、学习资料共享、自习邀约、交友广场、消息通知、全局搜索、收藏系统、关注动态。品牌以南京大学蓝鲸文化为背景。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Express 4.x + SQLite (sql.js WASM) |
| 认证 | JWT (jsonwebtoken) + bcryptjs |
| 邮件 | Resend API（验证码注册） |
| 文件上传 | Multer（磁盘存储） |
| 课表解析 | xlsx (SheetJS) |
| 前端 | 原生 JavaScript SPA + ES6 Modules |
| 设计系统 | Material Design 3（自定义 CSS） |
| Markdown | markdown-it（本地副本） |
| 图标 | Material Icons + Remix Icon |
| 测试 | node:test（17 个测试文件） |

## 项目结构

```
Lessonhelper/
├── server.js                    # Express 入口，数据库初始化，路由挂载
├── package.json                 # 依赖配置
├── rules                        # 前端设计规范 + 统一规则（颜色/排版/间距/组件/输入框规范）
├── CLAUDE.md                    # 本文件 — 项目指南
├── README.md                    # 项目说明与快速开始
├── data/
│   └── schedule/
│       ├── notes.md             # 导入说明
│       └── pre-notes.md         # 使用须知
├── docs/                        # 📚 项目文档
│   ├── requirements.md          #   开发需求文档
│   ├── tech-spec.md             #   技术规范（数据库/API/安全）
│   ├── development-steps.md     #   分步开发计划（当前进度 + 待办）
│   ├── api-spec.md              #   API 接口规范
│   └── course.md                #   课程系统设计文档
├── devlog/                      # 📝 开发日志（每天一个文件）
├── todolist/                    # 📋 待规划功能清单
├── tests/                       # 🧪 自动化测试（node:test，17 个文件）
├── db/                          # SQLite 数据库文件
├── routes/                      # 后端路由（14 个文件）
│   ├── auth.js                  #   注册/登录/个人信息/签到/数据导出
│   ├── courses.js               #   课程/帖子/评论/搭子帖/成员
│   ├── user.js                  #   用户公开名片/关注/反馈/关注动态
│   ├── schedule.js              #   课表导入
│   ├── materials.js             #   学习资料上传/下载/评分
│   ├── invites.js               #   自习邀约
│   ├── notifications.js         #   消息通知
│   ├── search.js                #   全局搜索
│   ├── square.js                #   交友广场
│   ├── explore_posts.js         #   发现模块帖子 CRUD
│   ├── explore_comments.js      #   发现模块评论（楼中楼 + 图片）
│   ├── explore_cards.js         #   发现模块卡片（加入/审批/投票）
│   ├── favorites.js             #   收藏（课程/帖子）
│   ├── my_posts.js              #   我的发布
│   └── middleware/
│       ├── auth.js              #   JWT 中间件（含 optionalAuth）
│       └── email.js             #   Resend 邮件服务
├── public/                      # 前端静态文件
│   ├── index.html               #   SPA 入口
│   ├── css/style.css            #   样式
│   └── js/
│       ├── main.js              #   全局入口：i18n + 跨层函数 + 初始化
│       ├── core/
│       │   ├── api.js           #   Fetch 请求层 + Token 管理
│       │   └── router.js        #   路由系统 + 动效引擎
│       ├── components/
│       │   ├── ui.js            #   MD3 组件工厂 + Toast + Modal
│       │   ├── tk-comments.js   #   统一评论区 UI 工具（tk-* 标准）
│       │   ├── card-renderer.js #   发现模块卡片渲染 + 计时器
│       │   └── echo-cave.js     #   回声洞（随机语录 + 用户投稿）
│       └── pages/
│           ├── auth.js          #   登录/注册 + 搜索页
│           ├── profile.js       #   个人中心（三栖视角 + 签到 + 关注）
│           ├── notifications.js #   通知中心（含路由跳转）
│           ├── favorites.js     #   我的收藏
│           ├── following_feed.js #  关注动态
│           ├── my_posts.js      #   我的发布
│           ├── notification_routes.mjs # 通知跳转路由映射
│           ├── explore.js       #   发现页（帖子流 + 详情 + 论坛式评论 + 冷却）
│           ├── post-editor.js   #   富文本帖子编辑器
│           ├── card-editor.js   #   卡片编辑器
│           ├── my-cards.js      #   我的卡片管理
│           ├── treasurebox.js   #   百宝箱（番茄钟/运势/决策/盲盒）
│           ├── explore/
│           │   ├── invites.js   #   自习邀约
│           │   ├── square.js    #   交友广场
│           │   └── posts.js     #   统一发布页（含编辑功能）
│           └── courses/
│               ├── my_courses.js #   我的课程（导入/列表/详情）
│               ├── all_courses.js#   课程广场（大课聚合）
│               ├── detail.js    #   统一大课空间详情页
│               ├── plaza.js     #   课程广场（只读视图，存量文件）
│               ├── publish.js   #   发布（富文本+附件）
│               ├── course_square.js # 课程搭子 Tab
│               └── post_attachments.js # 帖子附件渲染工具
└── uploads/                     # 上传文件存储
    ├── materials/               #   学习资料文件
    └── comment-images/          #   评论图片
```

## 数据库表（20 张）

| 表名 | 说明 |
|------|------|
| users | 用户账号（含 wechat/douyin/mbti/avatar_desc/签到/隐私字段） |
| courses | 课程目录 |
| posts | 课程论坛帖子 |
| comments | 帖子评论（支持 parent_id 楼中楼） |
| user_courses | 选课关系（多对多） |
| materials | 学习资料 |
| material_ratings | 资料评分 |
| study_invites | 自习邀约 |
| study_invite_responses | 邀约响应 |
| notifications | 消息通知 |
| square_posts | 交友广场帖子（7天过期，course_id 课程作用域） |
| square_interests | 广场感兴趣记录 |
| square_comments | 广场评论 |
| explore_posts | 发现模块帖子（全局流） |
| explore_comments | 发现模块评论（支持 parent_id 楼中楼 + 图片） |
| follows | 关注关系 |
| feedback | 问题反馈 |
| favorite_courses | 课程收藏 |
| favorite_posts | 帖子收藏 |
| post_attachments | 帖子附件 |

## 文档索引

| 需求 | 看这里 |
|------|--------|
| 产品要做什么功能 | [docs/requirements.md](docs/requirements.md) |
| 数据库表结构、API规范 | [docs/tech-spec.md](docs/tech-spec.md) |
| 开发到哪一步了 | [docs/development-steps.md](docs/development-steps.md) |
| API怎么调用 | [docs/api-spec.md](docs/api-spec.md) |
| 课程体系设计 | [docs/course.md](docs/course.md) |
| 今天的进度 | [devlog/](devlog/) 最新文件 |
| 样式规则 + 统一规范 | [rules](rules) |
| 待办事项 | [todolist/](todolist/) |
| 测试文件 | [tests/](tests/) |

## 开发规则

### 工作流程
1. **开始前**：查看 `docs/development-steps.md` 确认当前轮次
2. **开发中**：先后端后前端，API 先用 curl 测通
3. **每轮结束**：验证功能可用 → 更新 `development-steps.md` 打勾 → 更新 `devlog/` 当天日志
4. **提交代码**：每轮完成后 git commit

### 代码规范
- **每次修改代码前，必须先阅读 [rules](rules) 文件**，了解统一设定要求
- 所有 API 错误消息用中文
- author_id/owner_id 从 JWT 提取，不从请求体获取
- 密码用 bcryptjs 哈希（cost=10）
- 前端样式遵循 rules（无渐变、无玻璃态、色值用设计Token）
- 新页面用 `registerPage(name, renderFn)` 注册
- 输入框必须用 `createMdInput()` / `createMdSelect()` 工厂，禁止原生 `<select>`
- **输入框 placeholder 禁止使用汉字**，只允许 `placeholder: ' '`（一个空格）
- 评论系统统一使用论坛式风格（内联编辑器 + 图片上传 + 楼中楼递归 + 30 秒冷却）
- 冷却状态通过 localStorage 持久化，刷新不丢失

### 启动命令
```bash
npm install          # 安装依赖
npm run dev          # 启动服务器 http://localhost:3000
```

## 日志规则

- 每次开发会话开始：检查 `devlog/` 下是否有当天日志文件，没有则创建
- 每次开发会话结束：更新当天日志的完成事项和待办事项
- 日志文件命名：`YYYY-MM-DD.md`

---

> 创建于 2026-05-30 | 最后更新：2026-06-11（文档清理 + 评论统一 + 头像压缩）
