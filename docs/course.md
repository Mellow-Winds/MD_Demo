# 课程系统设计文档

> 最后更新：2026-06-03（修订：课程体系精简、选课上限修正）

---

## 目录

1. [课程的定义](#1-课程的定义)
2. [数据库结构](#2-数据库结构)
3. [课程的判断标准与匹配规则](#3-课程的判断标准与匹配规则)
4. [学期系统](#4-学期系统)
5. [课程导入机制](#5-课程导入机制)
6. [课程在界面中的显示](#6-课程在界面中的显示)
7. [课程与其他功能的关系](#7-课程与其他功能的关系)
8. [权限与业务规则](#8-权限与业务规则)
9. [API 接口一览](#9-api-接口一览)

---

## 1. 课程的定义

在课搭子中，课程体系分为两个层级：**大课**和**小课**。两者职责明确分离。

### 1.1 大课 vs 小课

| 概念 | 说明 | 存储方式 | 拥有空间？ |
|------|------|----------|-----------|
| **大课**（Big Course） | 一门课程的聚合体，如"离散数学" | 前端通过 `cleanBigCourseName()` 实时聚合 | ✅ 论坛、资料、搭子 |
| **小课**（精确课程） | 具体的教学班，如"离散数学07班" | `courses` 表中的一行 | ❌ 无独立空间 |

**核心原则**：
- **大课是内容的归属单位**：帖子、资料、搭子帖都归属于大课，所有班的同学共享同一空间
- **小课是信息的载体**：承载具体课程号、上课时间、地点、教师等元数据，仅显示在"我的课表"中

### 1.2 小课的数据字段

一条小课（精确课程）包含以下信息：

| 字段 | 来源 | 示例 |
|------|------|------|
| `title` | 课程名称（含班号） | `离散数学07班` |
| `teacher` | 授课教师 | `张三` |
| `description` | 课程号 · 上课时间 · 上课地点 | `CS20107 · 周一3-4节 · 教201` |
| `semester` | 学期标识（迁移字段） | `2025-2` |
| `owner_id` | 首位导入者 | `用户ID` |

### 1.3 小课的核心职责

小课只有两个核心职责：
1. **确定具体课程信息**：课程号、教师、时间、地点等元数据
2. **与大课关联**：通过 `cleanBigCourseName()` 清洗标题，将小课映射到对应的大课空间

小课**没有**自己的帖子区、资料区、搭子区。发帖时也**不**显示"同步发送到课程广场"开关——因为帖子本身就发在大课空间里。

### 1.4 课程的来源

小课通过两种方式产生：

1. **课表导入**：用户上传 `.xlsx` 格式的课表文件，系统自动解析并创建小课记录
2. **手动加入**：用户在"我的课程"页面搜索已有小课并加入

---

## 2. 数据库结构

### 2.1 courses 表（小课目录）

> ⚠️ 数据库中存储的都是**小课**（精确课程）。大课不存储，由前端实时聚合。

```sql
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,          -- 课程名称（含班号），如"离散数学07班"
    description TEXT DEFAULT '',  -- 存储格式："课程号 · 时间 · 地点"
    owner_id INTEGER NOT NULL,   -- 首位导入者（FK → users.id）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    semester TEXT DEFAULT '',     -- 学期标识（迁移添加）
    teacher TEXT DEFAULT ''       -- 教师姓名（迁移添加）
);
```

**`description` 字段的格式约定**：

```
课程号 · 上课时间 · 上课地点
```

示例：`CS20107 · 周一3-4节/周三1-2节 · 教学楼201`

> ⚠️ `description` 字段同时承担了"课程号"的存储职责。系统通过 `description LIKE '课程号%'` 来匹配已有小课，避免重复创建。

### 2.2 user_courses 表（选课关系，多对多）

```sql
CREATE TABLE user_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,      -- FK → users.id, ON DELETE CASCADE
    course_id INTEGER NOT NULL,    -- FK → courses.id, ON DELETE CASCADE
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    semester_key TEXT DEFAULT '',  -- 学期标识，如"2025-2"（迁移添加）
    UNIQUE(user_id, course_id)     -- 一个用户对一门课只能选一次
);
```

### 2.3 favorite_courses 表（课程收藏）

```sql
CREATE TABLE favorite_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,    -- FK → users.id, ON DELETE CASCADE
    course_id INTEGER NOT NULL,  -- FK → courses.id, ON DELETE CASCADE
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);
```

### 2.4 引用 course_id 的相关表

> ⚠️ 以下表中的 `course_id` 存储的是**小课 ID**，但在业务层面，内容归属于由 `cleanBigCourseName()` 聚合出的**大课空间**。前端聚合时会将同一大课下所有小课的帖子/资料合并展示。

| 表名 | 外键 | 说明 |
|------|------|------|
| `posts` | `course_id` NOT NULL | 课程论坛帖子，归属于大课空间 |
| `materials` | `course_id` NOT NULL | 学习资料，归属于大课空间 |
| `study_invites` | `course_id` **可空** | 自习邀约，NULL 表示全局邀约 |
| `square_posts` | `course_id` **可空** | 搭子帖，NULL 表示全局广场帖 |
| `notifications` | `course_id` **可空** | 消息通知，关联上下文课程 |

---

## 3. 课程的判断标准与匹配规则

### 3.1 课程去重（导入时）

当用户导入课表时，系统需要判断"这条课程记录是否已存在"，以避免重复创建。

**匹配逻辑**（`routes/schedule.js` → `findExistingCourse()`）：

```sql
SELECT id FROM courses
WHERE description LIKE '课程号%'
  AND title = '课程名'
  AND teacher = '教师名'
LIMIT 1
```

三个条件同时满足才认为是同一门课：
1. `description` 以课程号开头
2. `title` 完全一致（含班号，如"离散数学07班"）
3. `teacher` 完全一致

**如果匹配到**：复用已有的 `course_id`，只创建新的 `user_courses` 选课记录。
**如果未匹配到**：创建新的 `courses` 记录 + `user_courses` 选课记录。

### 3.2 大课聚合（显示时）

前端通过去除标题末尾的班号来聚合"大课"。大课是内容（帖子/资料/搭子）的归属单位。

**清洗逻辑**（`cleanBigCourseName()`）：

```
"离散数学07班" → "离散数学"
"高等数学A（上）03班" → "高等数学A（上）"
"大学英语" → "大学英语"  （无班号，保持不变）
```

规则：去除标题末尾连续的数字 + "班"后缀。

**聚合效果**：
- 数据库中"离散数学01班"和"离散数学02班"是两条独立的小课记录
- 前端将它们聚合为一个大课"离散数学"
- 这个大课拥有统一的论坛、资料区、搭子区
- 用户发帖时，帖子实际存储的是其中某条小课的 `course_id`，但展示时归属于大课空间

> ⚠️ 大课聚合是纯前端行为，后端不感知大课概念。

---

## 4. 学期系统

### 4.1 学期标识格式

`semester_key` 的格式为 `{年份}-{学期}`：

| 格式 | 含义 | 示例 |
|------|------|------|
| `{year}-1` | 秋季学期（第一学期） | `2025-1` |
| `{year}-2` | 春季学期（第二学期） | `2025-2` |
| `{year}-summer` | 暑期学期 | `2025-summer` |

### 4.2 学期自动判定

系统根据当前日期自动判定所处学期：

| 日期范围 | 判定结果 | 说明 |
|----------|----------|------|
| 8月15日 ~ 12月31日 | 秋季（`first`） | 当年秋季学期 |
| 1月1日 ~ 1月1日 | 秋季（`first`） | 秋季学期跨年延续 |
| 2月15日 ~ 6月14日 | 春季（`second`） | 春季学期 |
| 6月15日 ~ 8月14日 | 暑期（`summer`） | 暑期学期 |
| 1月2日 ~ 2月14日 | **封闭期**（`closed`） | 寒假，**禁止导入课表** |

### 4.3 学期与选课的关系

- `semester_key` 存储在 `user_courses` 表中，而非 `courses` 表
- 同一门课（同一个 `course_id`）可以被不同用户关联到不同学期
- 用户可以将已选课程"移学期"（`PUT /api/courses/:id/mmove-semester`）
- 每个用户每个学期只能导入一次课表

---

## 5. 课程导入机制

### 5.1 导入流程

```
用户上传 .xlsx 文件
    ↓
检查当前是否为封闭期 → 是 → 拒绝导入
    ↓ 否
检查用户本学期是否已导入过 → 是 → 拒绝导入
    ↓ 否
解析 Excel 表格（SheetJS）
    ↓
提取小课信息（课程号、名称、教师、时间、地点）
    ↓
去重（课程号+名称 唯一）
    ↓
逐门查找已有小课记录 → 找到则复用，否则新建
    ↓
创建 user_courses 选课记录（带 semester_key）
    ↓
返回导入结果
```

### 5.2 Excel 解析规则

- 读取第一个工作表
- 课程行：第 6、9、12、15、18、21 行（对应 6 个时间段）
- 每天 3 列（周一 ~ 周日，共 21 列）
- 每个单元格按换行符拆分，提取：课程号、课程名、教师、时间、地点
- 按 `课程号 + 课程名` 去重

### 5.3 导入限制

| 限制项 | 数值 |
|--------|------|
| 每用户**每学期**选课上限 | 50 门 |
| 单次导入上限 | 50 门 |
| 每学期导入次数 | 1 次 |
| 封闭期 | 1月2日 ~ 2月14日 |

---

## 6. 课程在界面中的显示

### 6.1 页面结构总览

```
我的课表（mycourse）          ← 小课列表，信息载体
    ├── 小课列表卡片（按学期筛选）
    ├── 搜索已有课程弹窗
    ├── 导入课表弹窗
    └── 小课详情（mycourse-detail）← 跳转到大课空间
            └── 跳转到对应大课的 course-detail

课程广场（allcourse）          ← 大课目录
    ├── 大课卡片列表（聚合展示）
    ├── 搜索栏
    └── 大课详情（course-detail）  ← 大课空间，拥有论坛/资料/搭子
            ├── 帖子 Tab（聚合所有班的帖子）
            ├── 资料 Tab（聚合所有班的资料）
            └── 搭子 Tab（聚合所有班的搭子帖）
```

### 6.2 我的课表（mycourse）

**页面入口**：底部导航 → 我的课程

**小课列表**（本质是课表，展示的是小课/精确课程）：
- 顶部学期筛选下拉框（包含"全部学期"选项）
- 每门小课显示为卡片：
  - 课程名称（`title`，含班号）
  - 教师姓名（`teacher`）
  - 课程描述（`description`，含课程号/时间/地点）
  - 选课人数（`enrollment_count`）
  - 操作按钮：移学期、退课
- 底部操作栏：搜索已有课程、导入课表

**搜索已有课程**：
- 弹窗中提供筛选条件：课程号、课程名、教师、星期
- 搜索接口：`GET /api/schedule/available`
- 每条结果显示"已加入"标记

**导入课表**：
- 流程：预读使用须知 → 同意条款 → 上传 .xlsx 文件 → 返回课程列表

### 6.3 课程详情（mycourse-detail / course-detail）

**mycourse-detail**（从小课卡片进入）：
- 显示小课的元数据（课程号、教师、时间、地点）
- 提供"进入大课空间"按钮，跳转到对应大课的 `course-detail`
- 也提供快捷入口：帖子、资料、搭子（直接跳转到大课空间的对应 Tab）

**course-detail**（大课空间，从广场/搜索/mycourse-detail 跳转进入）：
- 这是**大课的空间**，聚合了同一大课名下所有小课的内容
- 根据用户是否选了该大课下任意一门小课，动态调整：
  - **已选课**：3 Tab（帖子/资料/搭子）+ 发布 + 评论
  - **未选课**：2 Tab（帖子/资料）+ 只读模式
- 只读模式下，发布按钮禁用，显示 Toast "课程广场为只读档案馆"
- 只读模式下不渲染评论区域
- 帖子/资料显示"来自 [班名]"来源标签

### 6.4 课程广场（allcourse）

**页面入口**：探索 → 课程广场

**大课卡片**：
- 聚合展示：同一"大课"名下的所有小课合并为一张卡片
- 显示信息：
  - 大课名称（去除班号）
  - 包含班数（如"12个班"）
  - 总选课人数（所有班合计）
- 搜索栏支持实时过滤

**点击卡片**：进入大课空间 `course-detail` 页面

### 6.5 发布页（publish）

**帖子分类**：
- 讨论、资料分享、水贴、求助

**编辑器功能**：
- 富文本工具栏（加粗/斜体/下划线）
- 文件附件（最多 9 个，每个最大 20MB）
- **无**"同步到广场"开关——帖子直接发在大课空间，天然对所有班可见

---

## 7. 课程与其他功能的关系

### 7.1 课程论坛帖子

```
大课空间 ←── posts（course_id 存储小课 ID，但归属于大课空间）
                └── comments（嵌套评论，楼中楼）
                └── post_attachments（附件）
```

- 帖子归属于**大课空间**，同一门大课下所有班的同学共享
- `course_id` 字段存储的是发帖时用户所选小课的 ID
- 前端聚合时，将同一大课下所有小课的帖子合并展示
- 只有选课用户（选了该大课下任意一门小课）才能发帖
- 发帖后自动通知该大课下所有小课的成员

### 7.2 学习资料

```
大课空间 ←── materials（course_id 存储小课 ID，但归属于大课空间）
                └── material_ratings（评分）
```

- 资料归属于**大课空间**，同一门大课下所有班共享
- `course_id` 存储的是上传时用户所选小课的 ID
- 前端聚合时，将同一大课下所有小课的资料合并展示
- 支持 PDF、PPT、Word、图片，最大 20MB
- 有评分系统和下载计数
- 上传后自动通知该大课下所有小课的成员

### 7.3 课程搭子帖

```
大课空间 ←── square_posts（course_id 存储小课 ID，但归属于大课空间）
                └── square_interests（感兴趣记录）
                └── square_comments（评论）
```

- 搭子帖归属于**大课空间**，同一门大课下所有班共享
- `course_id` 存储的是发布时用户所选小课的 ID
- 与全局广场帖（`course_id = NULL`）共用同一张表
- 只有选课用户（选了该大课下任意一门小课）才能发布、查看、互动
- 7 天自动过期

### 7.4 自习邀约

```
courses ←── study_invites（course_id 可空）
```

- `course_id` 为 NULL 表示全局邀约
- `course_id` 不为 NULL 表示特定课程的邀约

### 7.5 消息通知

```
courses ←── notifications（course_id 可空）
```

通知类型与课程的关联：

| 通知类型 | 触发场景 |
|----------|----------|
| `new_post` | 课程有新帖子 |
| `new_comment` | 帖子有新评论 |
| `course_square_interest` | 有人对课程搭子帖表示感兴趣 |
| `course_square_accepted` | 搭子帖作者接受了你的申请 |
| `new_material` | 课程有新资料上传 |

通知通过 `notifyCourseMembers()` 函数发送，会排除动作发起者本人。

### 7.6 收藏系统

```
courses ←── favorite_courses（用户收藏课程）
posts ←── favorite_posts（用户收藏帖子，帖子有 course_id）
```

### 7.7 全局搜索

搜索接口 `GET /api/search` 在以下维度搜索课程相关内容：

- `courses.title`、`courses.description`、`courses.teacher`
- `materials` 表（关联课程名）
- `posts` 表（关联课程名）

### 7.8 用户主页

- `GET /api/user/:id/courses`：查看某用户选了哪些课
- 隐私设置 `privacy_show_profile` 可隐藏课程列表

### 7.9 我的发布

- `GET /api/my-posts/course-posts`：用户发布的所有帖子（关联课程名）
- `GET /api/my-posts/course-materials`：用户上传的所有资料（关联课程名）

---

## 8. 权限与业务规则

### 8.1 选课即权限（Enrollment-based Access）

系统不使用角色权限，而是以**是否选了该大课下任意一门小课**作为核心权限判断：

| 操作 | 已选课用户 | 未选课用户 |
|------|-----------|-----------|
| 浏览大课帖子 | ✅ | ✅（只读） |
| 在大课空间发帖 | ✅ | ❌ |
| 评论 | ✅ | ❌ |
| 上传资料 | ✅ | ❌ |
| 评分资料 | ✅ | ❌ |
| 查看大课搭子帖 | ✅ | ❌ |
| 发布搭子帖 | ✅ | ❌ |
| 表示感兴趣 | ✅ | ❌ |
| 收藏课程 | ✅ | ✅ |
| 浏览课程广场 | ✅ | ✅（只读） |

> 注：用户选的是小课，但权限判定是"该大课下是否有我选的小课"。

### 8.2 选课规则

- 每用户**每学期**最多 50 门课
- 同一门小课不能重复选（`UNIQUE(user_id, course_id)`）
- 可以退课（`DELETE /api/courses/:id/leave`）
- 可以移学期（`PUT /api/courses/:id/move-semester`）

### 8.3 课程搭子帖规则

- 仅选课用户可发布和互动
- 7 天自动过期
- 固定分类：考研搭子、考公搭子、考证搭子、项目组队、技能交换、竞赛组队、其他
- 不能对自己的帖子表示感兴趣
- 不能重复申请
- 当已接受人数达到 `max_people` 时，状态自动变为 "full"
- 状态流转：`open` → `full` / `closed` / `expired`

### 8.4 帖子规则

- 标题和内容必填
- 附件最多 9 个，每个最大 20MB
- 评论内容上限 500 字符
- 评论可附 1 张图片（最大 1MB，仅 JPG/PNG）
- 评论支持软删除（内容变为"[已删除]"）
- 嵌套评论最大视觉深度 3 层

---

## 9. API 接口一览

### 9.1 课程管理

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/courses/semesters` | ✅ | 获取当前用户的所有学期标识 |
| GET | `/api/courses/all` | ❌ | 获取所有课程（含选课人数），用于广场 |
| GET | `/api/courses` | ✅ | 获取当前用户的课程列表，支持 `?semester=` 筛选 |
| GET | `/api/courses/:id` | ❌ | 获取课程详情（含选课人数） |
| POST | `/api/courses/:id/enroll` | ✅ | 加入课程 |
| DELETE | `/api/courses/:id/leave` | ✅ | 退出课程 |
| PUT | `/api/courses/:id/move-semester` | ✅ | 移动课程到指定学期 |

### 9.2 课程论坛

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/courses/:id/posts` | ❌ | 获取课程帖子列表 |
| POST | `/api/courses/:id/posts` | ✅ | 发布帖子（需选课） |
| GET | `/api/courses/posts/:postId/comments` | ❌ | 获取帖子评论（分页+嵌套） |
| POST | `/api/courses/posts/:postId/comments` | ✅ | 发表评论 |
| DELETE | `/api/courses/posts/:postId/comments/:commentId` | ✅ | 删除自己的评论 |
| GET | `/api/courses/posts/:postId/comments/:commentId/replies` | ❌ | 获取嵌套回复 |
| GET | `/api/courses/posts/attachments/:id/view` | ❌ | 查看图片附件 |
| GET | `/api/courses/posts/attachments/:id/download` | ❌ | 下载文件附件 |

### 9.3 课程搭子帖

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/courses/:id/square-posts` | ✅ | 发布搭子帖（需选课） |
| GET | `/api/courses/:id/square-posts` | ✅ | 获取搭子帖列表（需选课） |
| GET | `/api/courses/:id/square-posts/:postId` | ✅ | 获取搭子帖详情 |
| DELETE | `/api/courses/:id/square-posts/:postId` | ✅ | 删除自己的搭子帖 |
| POST | `/api/courses/:id/square-posts/:postId/interest` | ✅ | 表示感兴趣 |
| PUT | `/api/courses/:id/square-interests/:interestId` | ✅ | 接受/拒绝申请 |
| GET | `/api/courses/:id/square-posts/:postId/comments` | ✅ | 获取搭子帖评论 |
| POST | `/api/courses/:id/square-posts/:postId/comments` | ✅ | 发表搭子帖评论 |
| DELETE | `/api/courses/:id/square-posts/:postId/comments/:commentId` | ✅ | 删除自己的评论 |

### 9.4 课表导入

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/schedule/notes` | ❌ | 获取导入说明 |
| GET | `/api/schedule/pre-notes` | ❌ | 获取使用须知 |
| POST | `/api/schedule/import` | ✅ | 上传 .xlsx 导入课表 |
| GET | `/api/schedule/available` | ✅ | 搜索可加入的课程 |

---

## 附录：前端文件清单

| 文件 | 注册页面 | 职责 |
|------|----------|------|
| `public/js/pages/courses/my_courses.js` | `mycourse`、`mycourse-detail` | 我的课表（小课列表）+ 小课详情 |
| `public/js/pages/courses/detail.js` | `course-detail` | 大课空间（根据选课状态切换功能） |
| `public/js/pages/courses/plaza.js` | `plaza-course` | 大课只读视图（聚合展示） |
| `public/js/pages/courses/all_courses.js` | `allcourse` | 课程广场目录（大课列表） |
| `public/js/pages/courses/publish.js` | `publish` | 发布帖子页（直接发到大课空间） |
| `public/js/pages/courses/course_square.js` | —（共享模块） | 搭子 Tab 渲染逻辑 |
| `public/js/pages/courses/post_attachments.js` | —（工具模块） | 帖子附件渲染 |

---

## 附录：关键架构模式

1. **大课-小课分离**：大课是内容空间（帖子/资料/搭子），小课是信息载体（课程号/时间/地点/教师）。数据库只存小课，大课由前端聚合。
2. **大课聚合**：`cleanBigCourseName()` 去除末尾班号，将多个小课映射到同一大课空间。
3. **内容归属大课**：帖子、资料、搭子帖的 `course_id` 存储小课 ID，但前端展示时聚合到大课空间。发帖不显示"同步到广场"开关。
4. **选课即权限**：用户选的是小课，但权限判定是"该大课下是否有我选的小课"。`isEnrolled()` 函数是所有写操作的门禁。
5. **semester_key 在 user_courses 而非 courses**：同一小课可被不同用户关联到不同学期。
6. **description 兼做课程号存储**：通过 `LIKE '课程号%'` 实现小课去重匹配。
