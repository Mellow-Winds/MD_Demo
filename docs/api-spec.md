# 课搭子 — API 接口规范

## 约定

- 基础路径：`http://localhost:3000/api`
- `[Auth]` = 需要 `Authorization: Bearer <token>` Header
- Content-Type: `application/json`（文件上传用 `multipart/form-data`）
- 错误响应格式：`{ "error": "中文错误消息" }`

---

## 1. 认证 `/api/auth`

### 注册（发送验证码）
```
POST /api/auth/register
```
Body: `{ "email", "password", "nickname", "major?", "grade?" }`
Response 201: `{ "message": "...", "debug_code": "123456" }`
> `debug_code` 仅在未配置邮件 API 时返回。

### 验证邮箱
```
POST /api/auth/verify-email
```
Body: `{ "email", "code" }`
Response 200: `{ "token": "...", "user": { ... } }`

### 登录
```
POST /api/auth/login
```
Body: `{ "email", "password" }`
Response 200: `{ "token": "...", "user": { ... } }`

### 重新发送验证码
```
POST /api/auth/resend-code
```
Body: `{ "email" }`

### 查个人信息 [Auth]
```
GET /api/auth/me
```
Response: user 对象（含 qq, wechat, douyin, mbti, avatar_desc, privacy_show_profile, privacy_allow_match, checkin_streak 等）

### 更新个人信息 [Auth]
```
PUT /api/auth/me
```
Body（全可选）: `{ "nickname?", "major?", "grade?", "avatar_url?", "qq?", "wechat?", "douyin?", "mbti?", "avatar_desc?", "privacy_show_profile?", "privacy_allow_match?" }`

### 每日签到 [Auth]
```
POST /api/auth/checkin
```
Response: `{ "streak": 5, "grace_days": 0, "message": "签到成功" }`

### 上传头像 [Auth]
```
POST /api/auth/avatar
```
Content-Type: `multipart/form-data`
Body: `avatar (file, ≤2MB, JPG/PNG)`
Response 200: `{ "avatar_url": "/uploads/avatars/xxx.jpg", "message": "头像已更新" }`
> 前端已完成三级压缩（预压缩 → 标准化 384×384 → 质量自动降级），后端直接存盘。

---

## 2. 课程 `/api/courses`

### 用户的学期列表 [Auth]
```
GET /api/courses/semesters
```
Response: `["2025-2026-2", ...]`

### 用户的课程列表 [Auth]
```
GET /api/courses?semester=2025-2026-2
```

### 全部课程（课程广场）
```
GET /api/courses/all?search=数据结构
```

### 课程详情
```
GET /api/courses/:id
```

### 加入课程 [Auth]
```
POST /api/courses/:id/enroll
```

### 退出课程 [Auth]
```
DELETE /api/courses/:id/leave
```

### 成员列表（支持筛选）
```
GET /api/courses/:id/members?major=计算机&grade=2024级&match_only=1
```

### 成员统计
```
GET /api/courses/:id/members/stats
```
Response: `{ "majors": [...], "grades": [...], "total": 45 }`

### 帖子列表
```
GET /api/courses/:id/posts
```

### 发帖 [Auth]
```
POST /api/courses/:id/posts
```
Body: `{ "title", "content" }`

### 评论列表
```
GET /api/courses/posts/:postId/comments
```

### 发评论 [Auth]
```
POST /api/courses/posts/:postId/comments
```
Body: `{ "content" }`

---

## 3. 用户 `/api/user`

### 公开信息
```
GET /api/user/:id
```

### 用户的课程
```
GET /api/user/:id/courses
```

### 公开名片（含关注计数 + 隐私过滤）
```
GET /api/user/:id/profile?viewer_id=1
```
Response: `{ ..., "followingCount": 5, "followerCount": 3, "isFollowing": false }`

### 关注用户 [Auth]
```
POST /api/user/:id/follow
```

### 取消关注 [Auth]
```
DELETE /api/user/:id/follow
```

### 粉丝列表
```
GET /api/user/:id/followers?limit=50&offset=0
```

### 关注列表
```
GET /api/user/:id/following?limit=50&offset=0
```

### 提交反馈 [Auth]
```
POST /api/user/feedback
```
Body: `{ "category": "bug|suggestion|other", "content", "contact?" }`

---

## 4. 课表导入 `/api/schedule`

### 导入说明
```
GET /api/schedule/notes
```

### 使用须知
```
GET /api/schedule/pre-notes
```

### 导入课表 [Auth]
```
POST /api/schedule/import
```
Body: `multipart/form-data` with `file` (.xlsx)
Response: `{ "imported": 8, "courses": [...] }`

### 搜索可选课程 [Auth]
```
GET /api/schedule/available?search=数据结构&day=周一
```

---

## 5. 学习资料 `/api/materials`

### 上传资料 [Auth]
```
POST /api/materials/courses/:courseId
```
Body: `multipart/form-data` with `file`, `title`, `description?`, `chapter?`, `category?`

### 资料列表
```
GET /api/materials/courses/:courseId?category=课件&chapter=第3章&sort=rating&page=1&pageSize=20
```

### 资料详情
```
GET /api/materials/:id
```

### 下载资料
```
GET /api/materials/:id/download
```

### 评分 [Auth]
```
POST /api/materials/:id/rate
```
Body: `{ "rating": 4 }`（1-5）

### 删除资料 [Auth，仅上传者]
```
DELETE /api/materials/:id
```

---

## 6. 自习邀约 `/api/invites`

### 发布邀约 [Auth]
```
POST /api/invites
```
Body: `{ "title", "description?", "study_date", "start_time", "end_time", "location?", "max_participants?", "course_id?" }`

### 邀约列表
```
GET /api/invites?date=today&status=open&course_id=1
```

### 我的邀约 [Auth]
```
GET /api/invites/my?type=created|joined|all
```

### 邀约详情 + 参与者
```
GET /api/invites/:id
```

### 响应邀约 [Auth]
```
POST /api/invites/:id/respond
```
Body: `{ "action": "join|cancel" }`

### 编辑邀约 [Auth，仅创建者]
```
PUT /api/invites/:id
```

### 取消邀约 [Auth，仅创建者]
```
DELETE /api/invites/:id
```

---

## 7. 消息通知 `/api/notifications`

### 通知列表 [Auth]
```
GET /api/notifications?page=1&pageSize=30
```
Response: `{ "notifications": [...], "total": 10, "unread": 3 }`

### 未读数量 [Auth]
```
GET /api/notifications/unread-count
```
Response: `{ "count": 3 }`

### 标记单条已读 [Auth]
```
PUT /api/notifications/:id/read
```

### 全部已读 [Auth]
```
PUT /api/notifications/read-all
```

---

## 8. 全局搜索 `/api/search`

### 搜索
```
GET /api/search?q=数据结构&type=all|courses|materials|posts
```
Response: `{ "courses": [...], "materials": [...], "posts": [...], "total": 15 }`

---

## 9. 交友广场 `/api/square`

### 发布帖子 [Auth]
```
POST /api/square/posts
```
Body: `{ "title", "category", "description?", "max_people?" }`
> category: 考研搭子 / 考公搭子 / 考证搭子 / 项目组队 / 技能交换 / 竞赛组队 / 其他

### 帖子列表 [Auth]
```
GET /api/square/posts?category=考研搭子
```

### 帖子详情 [Auth]
```
GET /api/square/posts/:id
```
Response: `{ ..., "confirmed": [...], "pending": [...], "my_status": "pending|accepted|null", "remaining_days": 5 }`

### 删除帖子 [Auth，仅创建者]
```
DELETE /api/square/posts/:id
```

### 表示感兴趣 [Auth]
```
POST /api/square/posts/:id/interest
```

### 接受/拒绝 [Auth，仅帖子创建者]
```
PUT /api/square/interests/:id
```
Body: `{ "action": "accept|reject" }`

### 我的广场 [Auth]
```
GET /api/square/my?type=created|interested
```

### 评论列表
```
GET /api/square/posts/:id/comments
```

### 发评论 [Auth]
```
POST /api/square/posts/:id/comments
```
Body: `{ "content" }`

---

## 9.1 课程搭子帖 `/api/courses/:id/square-posts`

课程作用域的搭子帖，需选课权限。

### 发布搭子帖 [Auth]
```
POST /api/courses/:id/square-posts
```
Body: `{ "title", "category", "description", "max_people" }`

### 课程搭子帖列表 [Auth]
```
GET /api/courses/:id/square-posts?category=考研搭子
```

### 帖子详情 [Auth]
```
GET /api/courses/:id/square-posts/:postId
```

### 删除帖子 [Auth]
```
DELETE /api/courses/:id/square-posts/:postId
```

### 表示感兴趣 [Auth]
```
POST /api/courses/:id/square-posts/:postId/interest
```

### 接受/拒绝 [Auth]
```
PUT /api/courses/:id/square-interests/:interestId
```
Body: `{ "action": "accept" | "reject" }`

### 评论列表
```
GET /api/courses/:id/square-posts/:postId/comments
```

### 发评论 [Auth]
```
POST /api/courses/:id/square-posts/:postId/comments
```
Body: `{ "content", "parent_id" }`

---

## 10. 我的发布 `/api/my-posts`

### 我的课程帖子 [Auth]
```
GET /api/my-posts/course-posts
```

### 我的课程资料 [Auth]
```
GET /api/my-posts/course-materials
```

---

## 11. 收藏 `/api/favorites`

### 收藏课程 [Auth]
```
POST /api/favorites/courses/:courseId
```

### 取消收藏课程 [Auth]
```
DELETE /api/favorites/courses/:courseId
```

### 收藏帖子 [Auth]
```
POST /api/favorites/posts/:postId
```

### 取消收藏帖子 [Auth]
```
DELETE /api/favorites/posts/:postId
```

### 收藏的课程列表 [Auth]
```
GET /api/favorites/courses
```

### 收藏的帖子列表 [Auth]
```
GET /api/favorites/posts
```

---

## 12. 关注动态

### 关注动态 Feed [Auth]
```
GET /api/user/feed
```
Response: 聚合已关注用户发布的学习资料、有效自习邀约和未过期广场帖子，按时间倒序。

---

## 13. 发现模块 `/api/explore`

### 帖子列表
```
GET /api/explore/posts?page=1&pageSize=20&keyword=搜索词&sort=latest|hot
```
Response: `{ "items": [...], "total": 30, "page": 1, "pageSize": 20 }`

### 帖子详情
```
GET /api/explore/posts/:id
```

### 发布帖子 [Auth]
```
POST /api/explore/posts
```
Body: `{ "content", "title?", "category?" }`

### 编辑帖子 [Auth，仅作者]
```
PUT /api/explore/posts/:id
```
Body: `{ "content", "title?", "category?" }`

### 删除帖子 [Auth，仅作者]
```
DELETE /api/explore/posts/:id
```

### 评论列表（游标分页）
```
GET /api/explore/posts/:postId/comments?lastCommentId=123&limit=20
```
Response: `{ "items": [...], "hasMore": true, "commentCount": 42 }`
> 每个一级评论附带最多 3 条二级回复（`replies` 数组）+ `has_more_replies` / `more_reply_count`。若已登录，每条评论返回 `is_liked` 和 `like_count`。

### 发表评论 [Auth]
```
POST /api/explore/posts/:postId/comments
```
Body (JSON): `{ "content", "parent_id?" }`
Body (FormData — 含图片): `content + parent_id? + image (file, ≤5MB, JPG/PNG/WebP)`
> 字数限制 200 字。支持 @提及解析，自动创建 `comment_mention` 通知。

### 点赞评论 [Auth]
```
POST /api/explore/posts/:postId/comments/:commentId/like
```
Response: `{ "liked": true, "like_count": 5 }`

### 取消点赞 [Auth]
```
DELETE /api/explore/posts/:postId/comments/:commentId/like
```
Response: `{ "liked": false, "like_count": 4 }`

### 删除评论 [Auth，仅作者]
```
DELETE /api/explore/posts/:postId/comments/:commentId
```
> 级联删除所有子回复 + 图片文件 + 点赞记录。

### 互关好友列表 [Auth]
```
GET /api/user/friends?q=搜索词&limit=20
```
Response: `{ "friends": [{ "id", "nickname", "username", "avatar_url", "grade", "major" }] }`
> 用于 @提及选择列表。


---


## 邮件配置

```bash
# Windows PowerShell
$env:RESEND_API_KEY="re_xxxxxx"

# Windows CMD
set RESEND_API_KEY=re_xxxxxx
```
不配置时，验证码通过 `debug_code` 在响应中返回。

---

> 最后更新：2026-06-11（新增头像上传端点、文档全面清理）
