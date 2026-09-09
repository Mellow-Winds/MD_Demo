# 课搭子 — 分步开发计划

## 总原则

- **小步快跑**：每轮只改1-3个文件，改完立即测试
- **先后端后前端**：API 先用 curl 测通，再做页面
- **每步可运行**：`node server.js` 不能崩
- **每轮提交 Git**

---

## 第1轮：认证系统后端 ✅

**目标**：邮箱验证码注册 + 密码登录，JWT Token

- [x] 安装 `jsonwebtoken`、`bcryptjs`、`resend`
- [x] `server.js`：users 表迁移（email, email_verified, verification_code 等8个新列）
- [x] 创建 `routes/middleware/auth.js`（JWT 中间件）
- [x] 创建 `routes/middleware/email.js`（Resend 邮件服务）
- [x] 创建 `routes/auth.js`（6个端点）
- [x] curl 全流程测试通过

**验证结果**：注册 → 验证码错误拒绝 → 正确验证码通过 → 登录成功 → JWT 查个人信息成功

---

## 第2轮：课程系统后端改造 ✅

**目标**：课程支持多人选课，有成员列表

- [x] `server.js`：user_courses 表 + courses 加 semester、teacher（第1轮已完成）
- [x] `routes/courses.js`：认证保护、创建者从 JWT 提取、成员列表、加入课程、帖子评论
- [x] `routes/user.js`：移除 /register，通过 user_courses 查用户课程
- [x] curl 全流程测试通过

**验证结果**：创建课程→自动加入→成员列表→发帖→评论→未认证拦截→公开信息不含密码

---

## 第3轮：前端认证系统 ✅

**目标**：前端能登录注册，状态持久化

- [x] `public/js/app.js`：完全重写，加入认证状态管理、JWT Token 持久化
- [x] API 封装：`apiGet`/`apiPost`/`apiPut` 自动附加 Authorization header
- [x] 登录/注册页面：tab 切换、邮箱验证码流程、表单验证、错误提示
- [x] 个人中心：登录后显示信息（头像/昵称/专业/年级）、编辑资料弹窗、退出登录
- [x] Toast 通知系统（替换 alert）
- [x] `public/index.html`：品牌名改为"课搭子"
- [x] `public/css/style.css`：新增 auth-tabs、form-field、avatar、info-chip、toast 样式
- [x] 全栈验证通过：注册→验证→登录→API调用，前后端协同工作

**验证结果**：页面加载正确、静态文件200 OK、注册登录全流程通过

---

## 第4轮：课程列表页前端 ✅

**目标**：浏览、创建、加入课程

- [x] `public/js/app.js`：课程卡片列表（标题/教师/学期/选课人数）
- [x] 创建课程弹窗（标题/教师/学期/描述）
- [x] 课程空状态友好提示
- [x] `public/css/style.css`：已有卡片样式

**验证**：课程列表正确展示、创建课程弹窗可用

---

## 第5轮：课程空间页（论坛）前端 ✅

**目标**：课程详情 = 论坛，发帖评论看成员

- [x] `public/js/app.js`：课程空间页面（课程信息 + 帖子列表 + 成员侧栏）
- [x] 帖子列表 + 发帖弹窗
- [x] 评论展开/收起 + 发评论
- [x] 成员侧栏（头像/昵称/专业/年级）
- [x] 已登录/未登录状态区分

**验证**：进课程空间 → 帖子列表 → 发帖 → 展开评论 → 发评论 → 成员列表

---

## 第6轮：打磨收尾 ✅

**目标**：品牌统一、体验优化

- [x] `public/index.html`：品牌名改为"课搭子"
- [x] Toast 通知系统（替换 alert）
- [x] 空状态/错误状态/加载状态处理
- [x] 「加入课程」按钮 + "已加入"标记
- [x] 验证码开发模式下直接页面显示
- [x] 更新 README.md

**验证**：全流程可用

---

## ✅ MVP 6轮全部完成！

> 当前进度：17/17 完成
> 最后更新：2026-06-11

---

## 维护记录：UI 细节修复 ✅

**目标**：修正 MD3 输入框缺口宽度与复合按钮图标基线偏移

- [x] 输入框浮起 Label 改用真实 `font-size: 0.75rem`，避免 `transform: scale()` 导致 legend 缺口物理宽度失真
- [x] `legend span` 同步为 `0.75rem`，让可见 Label 与边框断口宽度一致
- [x] `.mi` 图标盒改为固定 `1em` 的 `inline-flex`
- [x] 导航项与按钮分别加入 `--mi-y` 基线补偿，并保留 hover/active 缩放动效
- [x] Label 增加容器同色背景遮罩，避免聚焦描边穿过文字
- [x] MD 输入框统一强制 `placeholder=" "`，由纯 CSS `:not(:placeholder-shown)` / `:autofill` 接管浮起态
- [x] 增加 autofill 状态选择器，刷新后浏览器自动填充值也能在首帧顶起 Label

**验证**：本地服务 200；CSS 资源已包含新规则

---

## 第7轮：隐私设置 + QQ 号 ✅

**目标**：个人资料扩展，隐私控制基础设施

- [x] `server.js`：users 表新增 `qq`、`privacy_show_profile`、`privacy_allow_match` 字段
- [x] `routes/auth.js`：GET/PUT `/me` 支持 qq 和隐私字段
- [x] `routes/courses.js`：成员列表返回 qq，`privacy_show_profile=0` 时隐藏敏感信息
- [x] `app.js`：个人中心增加 QQ 展示和隐私开关，编辑资料增加 QQ 输入，成员侧栏显示 QQ（可复制）
- [x] `style.css`：toggle-switch 开关组件和 privacy-toggle-row 样式

**验证**：注册→编辑资料填 QQ→保存→刷新后 QQ 仍在；关闭隐私开关→成员列表隐藏敏感信息

---

## 第8轮：同课程同学匹配 ✅

**目标**：成员列表支持筛选，快速找到契合的学习伙伴

- [x] `routes/courses.js`：GET `/:id/members` 支持 `major`/`grade` 查询参数筛选，`match_only=1` 过滤隐私屏蔽用户
- [x] `routes/courses.js`：新增 GET `/:id/members/stats` 返回专业和年级分布
- [x] `app.js`：成员侧栏增加专业/年级下拉筛选框，提取 `renderMembersList` 和 `filterMembers` 函数
- [x] `style.css`：`member-filter-select` 和 `member-item` 样式

**验证**：进入课程空间→成员侧栏显示筛选器→选择专业筛选→列表实时更新

---

## 第9轮：学习资料共享 ✅

**目标**：用户上传资料，分类浏览，评分筛选

- [x] `server.js`：新建 `materials` 表（id, course_id, uploader_id, title, description, file_path, file_name, file_type, file_size, chapter, category, avg_rating, rating_count, download_count）和 `material_ratings` 表
- [x] `routes/materials.js`（新建）：POST 上传、GET 列表（筛选排序分页）、GET 详情、GET 下载、POST 评分、DELETE 删除
- [x] `app.js`：课程空间增加论坛/资料/成员标签页切换；资料卡片列表（类型图标、章节标签、评分星星、下载次数）；上传弹窗（拖拽+点击选择文件、标题、描述、章节、分类）；筛选排序；下载/删除
- [x] `style.css`：course-tabs 标签页、material-card 资料卡片、stars-row 评分星星、upload-drop-zone 拖拽上传区、member-card-grid 成员网格

**验证**：进课程空间→切换到资料标签→上传 PDF→填写信息→上传成功→其他用户可浏览/下载/评分

---

## 第10轮：自习搭子邀约 ✅

**目标**：发布自习邀约，浏览和响应邀约

- [x] `server.js`：新建 `study_invites` 表和 `study_invite_responses` 表
- [x] `routes/invites.js`（新建）：POST 发布、GET 列表（筛选）、GET 我的邀约、GET 详情+参与者、POST 响应（加入/取消）、PUT 编辑、DELETE 取消
- [x] `app.js`：新增 `invites` 和 `invites-my` 页面、发布邀约弹窗（标题/描述/日期/时间/地点/人数）、筛选（日期/状态）、加入/取消、我的邀约标签切换（发起/参与）
- [x] `index.html`：导航栏增加「自习邀约」入口
- [x] `style.css`：invite-card 邀约卡片、status-badge 状态标签、tab-btn 标签按钮

**验证**：发布邀约→出现在列表→其他用户可加入→满员自动标记「已满」→取消参与→我的邀约可查看发起和参与的

---

## 维护记录：下载文件名修复 ✅

- [x] 下载文件中文名乱码：改用标题+扩展名作为下载文件名（RFC 5987 编码）
- [x] multer 中文文件名编码：增加 Latin-1 → UTF-8 转换

---

## 第11轮：消息提醒 ✅

**目标**：新帖、评论、邀约回复、新资料实时提醒

- [x] `server.js`：新建 `notifications` 表
- [x] `routes/notifications.js`（新建）：GET 通知列表、GET 未读数量、PUT 标记已读、PUT 全部已读；导出 `createNotification` 和 `notifyCourseMembers` 辅助函数
- [x] 通知触发点：发帖→通知课程成员；评论→通知帖子作者；加入邀约→通知创建者；取消邀约→通知参与者；上传资料→通知课程成员
- [x] `app.js`：铃铛图标+未读角标+通知面板（下拉）+30秒轮询+点击跳转+全部已读
- [x] `index.html`：侧栏底部增加铃铛入口
- [x] `style.css`：notification-bell、notif-badge、notification-panel、notif-item、notif-unread 样式

**验证**：用户 A 发帖→用户 B 收到通知→铃铛显示角标→点击展开面板→点击通知跳转→全部已读

---

## 第12轮：全局搜索 ✅

**目标**：搜索课程、资料、帖子

- [x] `routes/search.js`（新建）：GET `/api/search?q=xxx&type=all|courses|materials|posts`，返回分组结果
- [x] `app.js`：侧栏搜索框（回车触发）、`search` 页面、搜索结果分 Tab（全部/课程/资料/帖子）、关键词高亮、搜索历史（localStorage 最近 5 条）
- [x] `index.html`：侧栏品牌下方增加搜索框
- [x] `style.css`：sidebar-search 搜索框、search-result-card 结果卡片、search-highlight 关键词高亮、search-tabs

**验证**：侧栏输入关键词回车→搜索结果页→分 Tab 展示→关键词高亮→点击跳转

---

## 第13轮：交友广场 ✅

**目标**：学习导向的轻社交广场，基于需求精准匹配

### 第 1 轮：后端 API
- [x] `server.js`：新建 `square_posts`、`square_interests`、`square_comments` 表
- [x] `routes/square.js`（新建）：POST 发帖（7天过期）、GET 列表（自动过滤过期+类型筛选）、GET 详情（含已确认成员+待处理）、DELETE 删除、POST 感兴趣、PUT 接受/拒绝、GET 我的广场、POST/GET 评论
- [x] 通知触发：有人感兴趣→通知发帖人；接受→通知申请人

### 第 2 轮：前端页面
- [x] `index.html`：导航栏增加「交友广场」入口
- [x] `app.js`：`square` 广场主页（列表+类型筛选+发帖弹窗）、`square-post` 帖子详情（感兴趣/接受拒绝/已确认成员含QQ/评论）、`square-my` 我的广场（发起/感兴趣 Tab）
- [x] `style.css`：square-post-card、square-category-tag 样式

### 第 3 轮：通知 + 过期
- [x] 通知触发已内置在路由中
- [x] 列表查询自动过滤过期帖子

**验证**：发帖→广场列表可见→其他用户感兴趣→发帖人收到通知→接受→双方可见QQ→评论正常

---

## 第14轮：前端 ES6 模块化重构 ✅

**目标**：将单文件 app.js 拆分为 ES6 模块架构

- [x] `public/js/main.js`（新建）：全局入口，i18n，跨层桥接函数
- [x] `public/js/core/api.js`（新建）：Fetch 请求层 + Token 管理
- [x] `public/js/core/router.js`（新建）：路由系统 + URL 映射 + 动效引擎
- [x] `public/js/components/ui.js`（新建）：MD3 组件工厂 + Toast + Modal
- [x] `public/js/pages/auth.js`（新建）：登录/注册 + 搜索页
- [x] `public/js/pages/profile.js`（新建）：个人中心
- [x] `public/js/pages/courses/my_courses.js`（新建）：我的课程
- [x] `public/js/pages/courses/plaza.js`（新建）：课程广场
- [x] `public/js/pages/courses/publish.js`（新建）：统一发布页
- [x] `public/js/pages/explore.js`（新建）：探索页入口
- [x] `public/js/pages/explore/invites.js`（新建）：自习邀约
- [x] `public/js/pages/explore/square.js`（新建）：交友广场
- [x] `public/js/pages/explore/posts.js`（新建）：统一发布页
- [x] `public/js/pages/my_posts.js`（新建）：我的创作
- [x] `public/js/pages/notifications.js`（新建）：通知中心
- [x] `public/index.html`：更新脚本引用

---

## 第15轮：个人空间模块重构 ✅

**目标**：个人空间升级为 MD3 质感仪表盘

- [x] `server.js`：users 表新增 7 列（wechat/douyin/avatar_desc/mbti/checkin_streak/last_checkin_date/grace_days）+ follows 表 + feedback 表
- [x] `routes/auth.js`：POST /checkin 签到 API（双重宽限期保护）
- [x] `routes/user.js`：公开名片 + 关注/取关 + 粉丝/关注列表 + 问题反馈
- [x] `public/js/pages/profile.js`：三栖视角（编辑/预览/公开）、签到勋章、完整度进度条、原位编辑、MBTI 选择器、关注系统、设置列表、子页面（edit/privacy/data/user）
- [x] `public/css/style.css`：~500 行 profile 专用样式

---

## 维护记录：课表导入文件迁移 ✅

- [x] `notes.md` → `data/schedule/notes.md`
- [x] `pre-notes.md` → `data/schedule/pre-notes.md`
- [x] `routes/schedule.js`：更新文件读取路径

---

## 第16轮：收藏、课程访问控制与帖子附件 ✅

**目标**：增加课程与课程帖子收藏，保护课程成员信息，并完善帖子附件体验。

- [x] `server.js`：新增 `favorite_courses`、`favorite_posts`、`post_attachments` 表。
- [x] `routes/favorites.js`：新增课程收藏、帖子收藏、取消收藏和按时间倒序查询接口。
- [x] `routes/courses.js`：课程成员列表和统计仅允许已加入课程的用户访问；课程发帖兼容 JSON 与 multipart 请求，支持最多 9 个附件、单文件最大 20MB。
- [x] 全局搜索：课程、资料和课程帖子结果按选课状态进入“我的课程”详情或课程广场只读详情；广场搜索文案统一为“广场”。
- [x] 前端：侧栏增加“我的收藏”，课程详情和课程帖子卡片增加收藏按钮，收藏帖子跳转后自动定位。
- [x] 前端：帖子附件支持多选；图片按 1/2/3/4-9 张自适应宫格预览，普通文件显示下载入口。
- [x] 测试：增加成员权限、搜索跳转、收藏 API、收藏页面、多附件发布和附件宫格回归测试。

**验证**：`npm test` 执行 24 个测试全部通过。

### 维护修复
- [x] 课程广场只读详情移除发布入口；课程帖子发布接口仅允许精确加入该课程的成员调用。
- [x] 课表导入复用课程时同时匹配课程号前缀、班级名和教师，避免不同班级错误合并。
- [x] 增加课程广场只读、非成员越权发帖和课表课程身份回归测试。

---

## 第17轮：关注系统闭环与隐私修复 ✅

**目标**：让用户关注关系产生实际用途，打通“发现同学 → 查看主页 → 关注 → 获取公开学习动态”的完整链路，并修复公开资料接口的隐私绕过问题。

- [x] `routes/middleware/auth.js`：新增 `optionalAuthMiddleware`，公开接口可识别已登录用户，但不强制要求登录。
- [x] `routes/user.js`：公开主页不再信任 URL 中的 `viewer_id`，仅使用 JWT 判断查看者身份。
- [x] `routes/user.js`：公开主页增加共同课程查询；关闭“公开个人资料”后，其他用户只能看到昵称和头像。
- [x] `routes/user.js`：关注用户后创建 `new_follower` 通知；粉丝和关注列表遵守资料隐私开关。
- [x] `routes/user.js`：新增 GET `/api/user/feed`，聚合已关注用户发布的学习资料、有效自习邀约和未过期广场帖子。
- [x] `public/js/pages/following_feed.js`（新建）：新增“关注动态”内容面板，按时间倒序展示公开学习动态并支持跳转。
- [x] `public/js/pages/notifications.js`：通知中心增加“消息通知 / 关注动态”页签，将关注动态整合到通知栏目。
- [x] `public/js/pages/profile.js`：公开主页增加关注/取消关注、共同课程展示；隐私锁定状态仍允许关注。
- [x] `public/js/pages/courses/my_courses.js`、`public/js/pages/courses/plaza.js`、`public/js/pages/explore/invites.js`、`public/js/pages/explore/square.js`：课程成员、帖子作者、评论用户、资料上传者、邀约发起人和广场用户昵称支持进入公开主页。
- [x] `public/js/pages/notification_routes.mjs`、`public/js/pages/notifications.js`：新增关注通知图标和通知点击跳转。
- [x] `tests/following.test.mjs`、`tests/following_frontend.test.mjs`、`tests/notification_routes.test.mjs`：增加隐私绕过、共同课程、关注通知、动态聚合、侧栏入口和通知跳转回归测试。

**验证**：`npm test` 执行 35 个测试全部通过；`node --check` 检查受影响模块全部通过；本地服务启动后访问首页返回 `HTTP 200`。

---

## 第18轮：课程系统扁平化重构 ✅

**目标**：消灭"小课空间"，全站统一为唯一的"大课空间详情页"

- [x] `public/js/core/router.js`：`mycourse-detail` 和 `plaza-course` 路由替换为 `course-detail`（`/course/:id`）
- [x] `public/js/pages/courses/my_courses.js`：精简为仅选修课表列表页，详情页逻辑全部迁出
- [x] `public/js/pages/courses/all_courses.js`（新建）：课程广场搜索页，聚合逻辑从 plaza.js 迁移
- [x] `public/js/pages/courses/detail.js`（新建）：全站唯一大课空间详情页，通过 courseId 动态评估选修状态
  - 已选修 → 三段药丸（论坛/资料/交友）+ 发布按钮激活
  - 未选修 → 两段药丸（论坛/资料）+ 发布按钮置灰 + 交友物理隐藏
- [x] `public/js/pages/courses/publish.js`：移除对 `_myCourseSpace` 依赖，返回统一导航到 `course-detail`
- [x] `public/js/pages/courses/plaza.js`：删除（功能迁移到 all_courses.js + detail.js）
- [x] `public/js/main.js`：更新 import 和 window 注册
- [x] `public/js/pages/auth.js`：`navigateToCourseResult` 简化为统一导航
- [x] 更新所有引用旧页面名的文件：`following_feed.js`、`profile.js`、`notification_routes.mjs`、`my_posts.js`
- [x] `public/css/style.css`：更新 `.btn-disabled` 样式支持 onclick Toast
- [x] 更新 6 个测试文件以匹配新页面名和文件结构

**验证**：`npm test` 执行 37 个测试全部通过；`node --check` 检查所有修改文件通过；本地服务返回 `HTTP 200`。

---

## 第19轮：探索模块重构 ✅

**目标**：组件化卡片系统 + 左右分栏流式编辑器 + 发现页统一帖子流

- [x] `server.js`：新增 `explore_posts`、`explore_cards`、`explore_comments`、`card_participants`、`card_vote_records`、`card_templates` 表
- [x] `routes/explore_posts.js`（新建）：帖子 CRUD（含内容 blocks JSON 解析）
- [x] `routes/explore_cards.js`（新建）：卡片加入/审批/投票
- [x] `routes/explore_comments.js`（新建）：帖子评论（楼中楼 + 图片上传）
- [x] `public/js/components/card-renderer.js`（新建）：卡片渲染引擎（8 种原子类型）
- [x] `public/js/pages/explore.js`（新建）：发现页（统一帖子流 + 搜索 + 详情 + 论坛式评论）
- [x] `public/js/pages/post-editor.js`（新建）：左右分栏流式编辑器（拖拽卡片 + Markdown）

## 维护记录：探索模块七项优化 ✅

**目标**：完善发现页功能闭环

- [x] 页面标题「探索」→「发现」
- [x] 帖子详情页添加删除按钮（仅作者可见）
- [x] 空状态居中对齐（桌面端）
- [x] 卡片支持发布后编辑（复用 post-editor 编辑弹窗）
- [x] 评论区升级为论坛风格（内联编辑器 + 图片上传 + 楼中楼 + 删除评论）
- [x] 课程交友贴支持编辑（新增 PUT 端点 + 编辑弹窗）
- [x] 文档同步更新

## 维护记录：2026-06-10 评论系统与通知优化 ✅

**目标**：修复楼中楼显示 / 通知跳转 / 冷却持久化 / 文档清理

- [x] **修复「发现」模块楼中楼不显示** — 后端递归构建嵌套树，前端展平 JSON 构建 childMap
- [x] **修复三楼及更深回复不渲染** — maxDepth: 3→10，`<` → `<=`
- [x] **「发现」模块新增 30 秒评论冷却** — 提交后按钮禁用 30 秒并显示倒计时
- [x] **localStorage 持久化冷却状态** — 探索模块 + 课程论坛，刷新自动恢复
- [x] **补全评论通知跳转** — `explore_post` → 帖子详情、`course_square_post` → 课程空间
- [x] **修复课程帖评论回复通知缺失 courseId**
- [x] **个人空间性别标签移到昵称下面** — 查看/公开/编辑三模式重排
- [x] **文档全面清理** — 删除重复/过时/空文档 14 个，更新 CLAUDE.md / README / api-spec
- [x] 测试：新增 2 个通知路由测试通过，全 49 测试 44 通过（5 个已有失败与本次无关）

---

## 维护记录：2026-06-10 晚间 — 评论昵称修复 + 通知跳转 ✅

**目标**：修复发现模块评论显示用户名而非昵称，通知中心点击跳转不生效

- [x] **修复评论昵称显示** — 后端 explore_comments.js SQL 改为查询 `u.nickname AS author_name`
- [x] **修复通知跳转** — 通知路由映射新增 `card` relatedType 跳转到发现页
- [x] **前端昵称兜底** — explore.js 渲染评论时 `displayName = author_nickname || author_name || '匿名'`

---

## 维护记录：2026-06-10 深夜 — 头像上传三级压缩 ✅

**目标**：优化头像上传，降低文件体积，提升加载速度

- [x] **前端三级压缩管线** — 预压缩（≤2048px, q=0.9）→ 标准化（384×384, q=0.92）→ 自动降级（q=0.9→0.3 直到 ≤2MB）
- [x] **前端阈值提升** — 原始文件检查从 2MB 提升到 30MB（极端容限）
- [x] **后端精简** — 移除 sharp 处理，直接保存 Multer 文件，仅保留 2MB 限制和格式校验
- [x] **上传进度** — XHR 替代 fetch，按钮显示百分比，上传期间取消按钮禁用
- [x] **EXIF 方向修正** — 预压缩阶段使用 canvas 重绘修正旋转

---

## 维护记录：2026-06-11 — 评论区完全统一 + 登录按钮修复 ✅

**目标**：消除 4 套评论区 UI 碎片化，统一为 tk-* 标准；修复登录页按钮折行

- [x] **新增 `public/js/components/tk-comments.js`** — 共享评论工具模块（~280 行），导出 renderTkComment / renderTkInputArea / toggleLike / bindTkCommentEvents 等 16 个函数
- [x] **课程论坛 detail.js 重构** — forum-* 类名全部替换为 tk-*，Material Icons 迁移到 Remix Icons，扁平化楼中楼，点赞从 Material `favorite` 改为 Remix `ri-heart-line/fill`
- [x] **交友广场 square.js 重构** — 评论区 + 输入区改为 tk-* 标准，新增点赞功能（此前缺失）
- [x] **课程搭子 course_square.js 重构** — 移除楼层号、移除 500 字限制、新增点赞、单行输入替代 textarea
- [x] **我的课程 my_courses.js 重构** — 同步 course_square.js 的改动，移除字数限制、新增点赞
- [x] **登录按钮修复** — `.auth-buttons .btn-text, .auth-buttons .auth-next-btn { white-space: nowrap }` 防止手机端折行
- [x] **formatTimeAgo 提升** — 从 explore.js 提取到 `ui.js` 作为公共导出
- [x] **代码净减 ~800 行** — 4 个评论区删除 ~1200 行重复代码，新增共享模块 +280 行
- [x] 11 个文件变更，+1158 -1281，提交 `9d1975c`

> 历史业务进度：全功能完成；当前入口已转为 Design Demo。
> 最后更新：2026-06-11

## 2026-09-09 — Design Demo 展示入口

- [x] 四个独立页面：总览、细节、温度、细则。
- [x] 移除运行时业务文案及品牌元素，收敛为四个基础色。
- [x] 共享输入、下拉、开关、弹窗、涟漪与可独立下载的组件示例。
- [x] 真实富文本、卡片编辑/增减/排序、实时预览与本机草稿。
- [x] 十二章规范及常驻目录，修复页内跳转误回首页。
- [x] 隔离只读服务，旧业务数据库与接口不随展示服务启动。
- [x] 根据最新反馈限制涟漪、取消分段滑动、修正提示居中和输入缺口、统一箭头、调整深色文字对比、增加进度动画。
- [x] 增加真实浏览器回归与桌面/移动端截图检查；具体结果见当天日志。
