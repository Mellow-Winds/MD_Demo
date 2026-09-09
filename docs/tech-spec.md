# 课搭子 — 技术规范

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js | — |
| 后端框架 | Express | ^4.21 |
| 数据库 | SQLite (sql.js WASM) | ^1.12 |
| 认证 | JWT (jsonwebtoken) + bcryptjs | Token 7 天有效 |
| 邮件 | Resend API | 验证码注册 |
| 文件上传 | Multer | 磁盘存储，20MB 限制 |
| 课表解析 | xlsx (SheetJS) | Excel 导入 |
| 前端 | 原生 JavaScript SPA + ES6 Modules | — |
| 设计系统 | Material Design 3 + 自定义 CSS | — |
| Markdown | markdown-it | 本地副本 |
| 图标 | Material Icons + Remix Icon | — |

---

## 数据库设计（21 张表，实际 28 张详见 server.js）

### users

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| username | TEXT | — | 用户名（= 邮箱） |
| display_name | TEXT | — | 显示名 |
| avatar_url | TEXT | '' | 头像 URL |
| created_at | DATETIME | CURRENT_TIMESTAMP | 注册时间 |
| password_hash | TEXT | '' | bcrypt 密码哈希 |
| nickname | TEXT | '' | 昵称 |
| major | TEXT | '' | 专业 |
| grade | TEXT | '' | 年级 |
| email | TEXT | '' | 邮箱 |
| email_verified | INTEGER | 0 | 邮箱已验证 |
| verification_code | TEXT | '' | 验证码 |
| verification_code_expires | TEXT | '' | 验证码过期时间 |
| qq | TEXT | '' | QQ 号 |
| wechat | TEXT | '' | 微信号 |
| douyin | TEXT | '' | 抖音号 |
| avatar_desc | TEXT | '' | 肖像描述（80 字） |
| mbti | TEXT | '' | MBTI 人格类型 |
| privacy_show_profile | INTEGER | 1 | 公开个人信息 |
| privacy_allow_match | INTEGER | 1 | 允许被匹配 |
| checkin_streak | INTEGER | 0 | 连续签到天数 |
| last_checkin_date | TEXT | '' | 上次签到日期 |
| grace_days | INTEGER | 0 | 签到缓冲天数 |

### courses

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| title | TEXT | — | 课程名称 |
| description | TEXT | '' | 描述 |
| owner_id | INTEGER | — | 创建者 ID |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |
| semester | TEXT | '' | 学期 |
| teacher | TEXT | '' | 授课教师 |

### user_courses

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| user_id | INTEGER | — | 用户 ID（FK → users） |
| course_id | INTEGER | — | 课程 ID（FK → courses） |
| enrolled_at | DATETIME | CURRENT_TIMESTAMP | 选课时间 |
| semester_key | TEXT | '' | 学期标识 |

UNIQUE(user_id, course_id)

### posts

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| course_id | INTEGER | — | 课程 ID |
| author_id | INTEGER | — | 作者 ID |
| title | TEXT | — | 标题 |
| content | TEXT | — | 内容 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 发帖时间 |

### comments

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| post_id | INTEGER | — | 帖子 ID |
| author_id | INTEGER | — | 评论者 ID |
| content | TEXT | — | 内容 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 评论时间 |

### materials

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| course_id | INTEGER | — | 课程 ID |
| uploader_id | INTEGER | — | 上传者 ID |
| title | TEXT | — | 标题 |
| description | TEXT | '' | 描述 |
| file_path | TEXT | — | 存储文件名 |
| file_name | TEXT | — | 原始文件名 |
| file_type | TEXT | — | pdf/ppt/doc/image/other |
| file_size | INTEGER | 0 | 文件大小（字节） |
| chapter | TEXT | '' | 章节 |
| category | TEXT | '其他' | 分类 |
| avg_rating | REAL | 0 | 平均评分 |
| rating_count | INTEGER | 0 | 评分人数 |
| download_count | INTEGER | 0 | 下载次数 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 上传时间 |

### material_ratings

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| material_id | INTEGER | — | 资料 ID |
| user_id | INTEGER | — | 评分者 ID |
| rating | INTEGER | — | 评分（1-5） |
| created_at | DATETIME | CURRENT_TIMESTAMP | 评分时间 |

UNIQUE(material_id, user_id)

### study_invites

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| creator_id | INTEGER | — | 创建者 ID |
| course_id | INTEGER | null | 关联课程 |
| title | TEXT | — | 标题 |
| description | TEXT | '' | 描述 |
| study_date | TEXT | — | 日期（YYYY-MM-DD） |
| start_time | TEXT | — | 开始时间（HH:MM） |
| end_time | TEXT | — | 结束时间（HH:MM） |
| location | TEXT | '' | 地点 |
| max_participants | INTEGER | 4 | 人数上限 |
| status | TEXT | 'open' | open/full/closed/expired |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |

### study_invite_responses

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| invite_id | INTEGER | — | 邀约 ID |
| user_id | INTEGER | — | 响应者 ID |
| status | TEXT | 'accepted' | accepted/cancelled |
| created_at | DATETIME | CURRENT_TIMESTAMP | 响应时间 |

UNIQUE(invite_id, user_id)

### notifications

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| user_id | INTEGER | — | 接收者 ID |
| type | TEXT | — | 通知类型 |
| title | TEXT | — | 标题 |
| message | TEXT | — | 消息内容 |
| related_type | TEXT | null | 关联对象类型 |
| related_id | INTEGER | null | 关联对象 ID |
| course_id | INTEGER | null | 关联课程 ID |
| is_read | INTEGER | 0 | 是否已读 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |

### square_posts

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| creator_id | INTEGER | — | 创建者 ID |
| title | TEXT | — | 标题 |
| category | TEXT | — | 需求类型 |
| description | TEXT | '' | 描述 |
| max_people | INTEGER | 1 | 期望人数 |
| current_count | INTEGER | 0 | 当前已确认人数 |
| status | TEXT | 'open' | open/full/closed/expired |
| expires_at | TEXT | — | 过期时间 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |
| course_id | INTEGER | NULL | 所属课程 ID（NULL = 全局广场帖，非 NULL = 课程内搭子帖） |

### square_interests

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| post_id | INTEGER | — | 帖子 ID |
| user_id | INTEGER | — | 感兴趣的用户 ID |
| status | TEXT | 'pending' | pending/accepted/rejected |
| created_at | DATETIME | CURRENT_TIMESTAMP | 时间 |

UNIQUE(post_id, user_id)

### square_comments

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| post_id | INTEGER | — | 帖子 ID |
| author_id | INTEGER | — | 评论者 ID |
| content | TEXT | — | 内容 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 时间 |

### follows

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| follower_id | INTEGER | — | 关注者 ID |
| following_id | INTEGER | — | 被关注者 ID |
| created_at | DATETIME | CURRENT_TIMESTAMP | 关注时间 |

UNIQUE(follower_id, following_id)

### feedback

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| user_id | INTEGER | — | 提交者 ID |
| category | TEXT | — | bug/suggestion/other |
| content | TEXT | — | 内容 |
| contact | TEXT | '' | 联系方式 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 提交时间 |

### favorite_courses

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| user_id | INTEGER | — | 用户 ID |
| course_id | INTEGER | — | 课程 ID |
| created_at | DATETIME | CURRENT_TIMESTAMP | 收藏时间 |

UNIQUE(user_id, course_id)

### favorite_posts

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| user_id | INTEGER | — | 用户 ID |
| post_id | INTEGER | — | 帖子 ID |
| created_at | DATETIME | CURRENT_TIMESTAMP | 收藏时间 |

UNIQUE(user_id, post_id)

### post_attachments

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| post_id | INTEGER | — | 帖子 ID |
| file_path | TEXT | — | 存储文件名 |
| file_name | TEXT | — | 原始文件名 |
| file_type | TEXT | — | 文件类型 |
| file_size | INTEGER | 0 | 文件大小（字节） |
| created_at | DATETIME | CURRENT_TIMESTAMP | 上传时间 |

### explore_posts

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| creator_id | INTEGER | — | 发布者 ID |
| title | TEXT | — | 标题 |
| content | TEXT | — | 内容（JSON blocks 数组） |
| created_at | DATETIME | CURRENT_TIMESTAMP | 发布时间 |
| updated_at | DATETIME | CURRENT_TIMESTAMP | 更新时间 |

### explore_comments

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| post_id | INTEGER | — | 帖子 ID |
| author_id | INTEGER | — | 评论者 ID |
| content | TEXT | — | 内容 |
| image_url | TEXT | '' | 评论图片 URL |
| parent_id | INTEGER | NULL | 父评论 ID（楼中楼） |
| like_count | INTEGER | 0 | 点赞数 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 评论时间 |

### explore_cards

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | AUTO | 主键 |
| post_id | INTEGER | — | 帖子 ID |
| type | TEXT | — | 卡片类型 |
| data | TEXT | — | 卡片数据（JSON） |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |

---

## API 设计规范

### 认证
- JWT Token，Header：`Authorization: Bearer <token>`
- Token 有效期：7 天
- 需要认证的端点标注 `[Auth]`
- `optionalAuthMiddleware`：公开接口可识别已登录用户，但不强制要求登录

### 响应格式
- 成功：返回数据对象或数组，HTTP 2xx
- 失败：`{ "error": "中文错误描述" }`，HTTP 4xx/5xx

### 安全
1. 密码 bcryptjs 哈希，cost factor = 10
2. author_id/owner_id 从 JWT 提取，不从请求体获取
3. SQL 参数化查询
4. 所有输入验证
5. 详细安全审计见 [todolist/security.md](../todolist/security.md)

---

## 前端架构

- SPA 模式，`registerPage()` + `navigateTo()`
- ES6 Modules：main.js（入口）→ core/（api + router）→ components/（ui）→ pages/（页面）
- 全局状态：`window._currentUser`
- API 封装自动附加 Authorization header
- 通知轮询：每 30 秒检查未读数
- 样式遵循 [rules](../rules)
- 测试框架：`node:test`，17 个测试文件在 `tests/` 目录

---

> 最后更新：2026-06-11
