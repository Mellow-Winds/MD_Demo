/**
 * seed_demo.js — 课搭子 演示数据一键填充脚本
 *
 * 使用方法：
 *   1. 确保服务器未运行
 *   2. node seed_demo.js
 *   3. 脚本会自动启动服务器、填充数据、保持服务器运行
 *
 * 清理数据：
 *   node clean_demo.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ─── 加载环境变量 ───
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '';
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const DB_PATH = path.join(__dirname, 'db', 'eduspace.db');

// ─── 用户密码 ───
const USER_PASSWORD = 'Test1234';
const PASSWORD_HASH = bcrypt.hashSync(USER_PASSWORD, 10);

// ═══════════════════════════════════════════════════════════════
// 数据池
// ═══════════════════════════════════════════════════════════════

const NICKNAMES = [
  '图书馆常驻人口', '算法练习生', '早八终结者', '咖啡续命中', '期末生存者',
  '摸鱼大队长', '南大在逃卷王', '代码敲到天亮', '自习室钉子户', 'PPT纺织女工',
  '数据结构受害者', '线代破防人', '食堂干饭王', '操场夜跑侠', '雅思不上岸不改名',
  '考研气氛组', '四六级虐我千百遍', '学分收割机', 'DDL战神', '小组作业扛把子',
  '课件搬运工', '上课坐后排', '笔记小能手', '论文裁缝', '北大楼晒太阳',
  '仙林校区原住民', '鼓楼常驻民', '杜厦图书馆保安', '方肇周体育馆常客',
  '开水房继承人', '宿舍躺平大师', '快乐女大学生', '积极废柴', '熬夜冠军',
  '吃瓜一线', '选课系统克星', '后勤基建处编外', '猫猫饲养员', '光合作用中',
  '软件工程搬砖工', '文科楼扫地僧', '实验室鼠鼠', '人间清醒', '睡不醒的冬眠兽',
  '卷又卷不动躺又躺不平', '赛博朋克养生', '食堂第九窗口代言人', '通识课混子',
  '逃课被抓选手', '早课永远迟到'
];

const MAJORS = [
  '计算机科学与技术', '软件工程', '工商管理', '法学',
  '汉语言文学', '新闻传播学', '信息管理与信息系统',
  '电子信息工程', '数学与应用数学', '物理学',
  '化学', '生物科学'
];

const GRADES = ['2023级', '2024级', '2025级'];
const MBTIS = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
               'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];

const GENDERS = ['male', 'female'];

const BIO_TEMPLATES = [
  '热爱学习，喜欢{x}，欢迎一起交流！',
  '{y}在读，平时喜欢{x}，希望找到志同道合的朋友～',
  '主打一个{x}，{y}专业不请自来',
  '{y}人，日常{x}，来找我玩呀',
  '努力学习{x}中，{y}的课友看过来',
];

const HOBBIES = ['打篮球', '跑步', '看电影', '追剧', '打游戏', '看小说', '写代码',
  '听音乐', '摄影', '画画', '弹吉他', '逛吃', '桌游', '剧本杀', '撸猫'];

// ─── 课程数据 ───
const COURSES = [
  { title: '软件工程概论', teacher: '王建国', semester: '2025-2026-2', description: '面向对象方法、软件过程模型、需求分析与系统设计' },
  { title: '数据结构与算法', teacher: '李明远', semester: '2025-2026-2', description: '线性表、树、图、排序算法、复杂度分析' },
  { title: '操作系统', teacher: '张伟民', semester: '2025-2026-2', description: '进程管理、内存管理、文件系统、I/O系统' },
  { title: '数据库原理', teacher: '陈志华', semester: '2025-2026-2', description: '关系模型、SQL、范式理论、事务与并发控制' },
  { title: '大学英语（四）', teacher: '刘芳', semester: '2025-2026-2', description: '学术英语阅读、写作、口语表达' },
  { title: '马克思主义基本原理', teacher: '赵德明', semester: '2025-2026-2', description: '辩证唯物主义、历史唯物主义、政治经济学' },
];

// ─── 搭子帖数据池 ───
// 每个帖子: { title, description, category, max_people, type }
// type: 'course' | 'global' — 25 课程帖 + 15 全局帖
const SQUARE_POSTS = [
  // ═══ 学习类 15 条 ═══
  { title: '软工期末抱佛脚小组', desc: '软工概论期末快到了，组个复习小分队一起刷题整理重点。有往年题的同学求分享！我这边有几套18-24的真题可以共享。', category: '项目组队', max: 4, type: 'course', courseIdx: 0 },
  { title: '考研408组队刷题', desc: '25考研备战中，想找2-3个考408的小伙伴每天一起刷题打卡。主要刷王道+真题，有研友一起么？', category: '考研搭子', max: 3, type: 'global' },
  { title: '省考行测搭子滴滴', desc: '正在准备省考，每天去图书馆刷行测，想找个搭子互相监督。主要做粉笔5000题，偶尔也会刷申论。', category: '考公搭子', max: 2, type: 'global' },
  { title: '六级刷分小组', desc: '六级550+冲600的有没有！一起练听力刷阅读，每周做一套真题然后对答案讨论。', category: '考证搭子', max: 4, type: 'global' },
  { title: '软工设计模式讨论组', desc: '最近在学设计模式，单例工厂观察者这些感觉理解不够深入。想组3-4人讨论组，每周一个模式，用Java/Python写demo交流。', category: '项目组队', max: 4, type: 'course', courseIdx: 0 },
  { title: '数据结构期末突击', desc: '二叉树、图算法那块有点崩，找两个课友一起把课后题过一遍。重点复习Dijkstra和Floyd最短路径。', category: '项目组队', max: 3, type: 'course', courseIdx: 1 },
  { title: '教资备考小分队', desc: '准备下半年教资，有没有一起的？主要考高中信息技术，一起背教育知识与能力。', category: '考证搭子', max: 3, type: 'global' },
  { title: '操作系统实验互助', desc: '实验三的进程调度实现卡住了，有人一起研究吗？我用C写的，也可以交流Python版本。', category: '项目组队', max: 3, type: 'course', courseIdx: 2 },
  { title: '数据库SQL刷题群', desc: 'leetcode上数据库题刷得差不多了，想找几个人一起刷牛客SQL题，互相讨论解题思路。', category: '项目组队', max: 5, type: 'course', courseIdx: 3 },
  { title: '雅思口语对练', desc: '目标7.0，口语相对弱。找1-2人每周2次线上对练，用当季题库。最好也是南京校区的，可以线下模考。', category: '考证搭子', max: 2, type: 'global' },
  { title: '马原期末笔记共享', desc: '赵老师班的马原重点有人整理了没？我这边有前三章的思维导图，可以互换资料。', category: '项目组队', max: 3, type: 'course', courseIdx: 5 },
  { title: 'ACM集训预备队', desc: '下学期想打ACM，暑假提前组个预备队一起刷题。要求有一定算法基础，每周至少刷5道medium以上。', category: '竞赛组队', max: 3, type: 'global' },
  { title: '软工课设项目组队', desc: '软工课设要做一个小型项目管理系统，技术栈用SpringBoot+Vue，组4人队。我是后端方向，还缺前端和测试。', category: '项目组队', max: 4, type: 'course', courseIdx: 0 },
  { title: '考研数学一对练', desc: '数一复习中，高数下册多重积分那块比较容易混，有没有一起过知识点的同学？', category: '考研搭子', max: 2, type: 'global' },
  { title: '英语四小组pre搭子', desc: '下周英语课小组pre要准备，还差两人。主题是社交媒体对大学生的影响，已经写了outline。', category: '项目组队', max: 2, type: 'course', courseIdx: 4 },

  // ═══ 生活类 8 条 ═══
  { title: '夜跑搭子求组队', desc: '每天晚上九点操场夜跑，配速6分半左右，跑5公里。一个人总是偷懒，找个伴互相监督！', category: '其他', max: 2, type: 'global' },
  { title: '食堂拼饭小分队', desc: '四食堂石锅拌饭忠实粉丝，中午11:45左右去不用排太久。寻饭搭子，AA不浪费～', category: '其他', max: 3, type: 'global' },
  { title: '图书馆早起占座联盟', desc: '期末季杜厦图书馆座位靠抢，有没有早上七点能到的同学组个占座互助群？轮流帮占。', category: '其他', max: 3, type: 'global' },
  { title: '校园跑腿互助', desc: '经常去快递站拿快递，住在四组团。找附近同学互相帮忙代拿快递/代买饭，省时省力。', category: '其他', max: 3, type: 'global' },
  { title: '周末骑行小队', desc: '周末喜欢骑车出去逛，玄武湖-紫金山路线为主。休闲骑不竞速，有车就行没车可以共享单车。', category: '其他', max: 5, type: 'global' },
  { title: '篮球约球群', desc: '每周二四下午方肇周体育馆打篮球，强度适中主要是出出汗。水平不要求高，开心就好！', category: '其他', max: 4, type: 'global' },
  { title: '宿舍健身搭子', desc: '宿舍买了哑铃和瑜伽垫，主要练上肢和核心。一个人练总是偷懒，寻室友圈健身搭子。', category: '其他', max: 2, type: 'global' },
  { title: '二手书交易互助', desc: '快期末了，有没有人要出手下学期的教材？或者互换也可以。我这有软工、数据库的课本。', category: '其他', max: 5, type: 'course', courseIdx: 3 },

  // ═══ 娱乐类 5 条 ═══
  { title: '追剧搭子-一起来看', desc: '最近在看《庆余年2》，有没有也在追的一起讨论剧情！顺便求推荐类似的古装剧～', category: '其他', max: 5, type: 'global' },
  { title: '王者上分车队', desc: '王者荣耀钻石段求车队，主打中路和辅助。周末晚上一般在线，心态好不骂人。', category: '其他', max: 4, type: 'global' },
  { title: '五一南京周边游', desc: '五一假期想出去转转，南京周边比如扬州或苏州都可以。寻1-2人结伴，计划玩2天。', category: '其他', max: 2, type: 'global' },
  { title: '音乐节搭子', desc: '下个月南京有个音乐节有想去的小伙伴吗？阵容还不错，一起买票拼车去～', category: '其他', max: 3, type: 'global' },
  { title: '周末桌游局', desc: '每周六下午组桌游，狼人杀/阿瓦隆/三国杀都行。地点一般在南大附近咖啡馆，有牌自己带。', category: '其他', max: 5, type: 'global' },

  // ═══ 技能类 7 条 ═══
  { title: 'Python编程互助', desc: '自学Python中，目前在学爬虫和数据分析。有同在学习的小伙伴一起交流项目经验呀～', category: '技能交换', max: 3, type: 'course', courseIdx: 1 },
  { title: '吉他入门教学互换', desc: '会一点吉他（弹唱水平），可以教基础。想换英语口语或者日语基础。技能交换，不收费。', category: '技能交换', max: 2, type: 'global' },
  { title: '摄影约拍小分队', desc: '喜欢拍人像和风景，有模特想拍照或者摄影师想交流的都欢迎！周末一般在校园里拍。', category: '技能交换', max: 4, type: 'global' },
  { title: '前端Vue学习小组', desc: '软工课设要用Vue，但我基础一般。找几个也在学前端的同学一起做练手项目，互相code review。', category: '技能交换', max: 3, type: 'course', courseIdx: 0 },
  { title: 'PS/AI设计互助', desc: '会用PS做海报和封面，可以帮做简单的设计。想换一点点摄影技巧或者视频剪辑经验。', category: '技能交换', max: 2, type: 'global' },
  { title: '日语学习搭子', desc: '标日初级上册快学完了，找也在学日语的同学一起练口语和听写。目标N3过级。', category: '技能交换', max: 2, type: 'global' },
  { title: '数学建模竞赛组队', desc: '9月国赛组队，还差一个编程手。我用Python+MATLAB，最好有运筹学基础的优先。', category: '竞赛组队', max: 1, type: 'course', courseIdx: 1 },

  // ═══ 其他类 5 条 ═══
  { title: '大创项目招募问卷被试', desc: '大创项目关于大学生手机使用习惯的调查，需要填写一份10分钟问卷。有偿！5元红包+数据反馈。', category: '其他', max: 5, type: 'course', courseIdx: 0 },
  { title: '暑期实习信息共享群', desc: '大三了在找暑期实习，建个群分享互联网/快消/咨询行业的实习信息。有offer的也欢迎分享面经。', category: '其他', max: 5, type: 'global' },
  { title: '毕业设计互审', desc: '毕设论文初稿快写完了，找同在写毕设的同学互相审阅提意见。不限专业，主要是格式和表达。', category: '其他', max: 3, type: 'global' },
  { title: '数据结构课程设计交流', desc: '课设选题纠结中，想听听大家的想法。我目前倾向于做迷宫求解或者Huffman压缩，有人一起讨论吗？', category: '项目组队', max: 4, type: 'course', courseIdx: 1 },
  { title: '操作系统大作业交流', desc: '自制shell的大作业，目前基本功能跑通了但管道和重定向有bug。有没有也在写的一起debug？', category: '项目组队', max: 3, type: 'course', courseIdx: 2 },
];

// ─── 评论数据池（按主题分类） ───
const COMMENT_POOLS = {
  study: [
    '算我一个！我也在准备这个，可以一起刷题',
    '有往年真题可以分享一下吗？谢谢！',
    '加油加油，一起努力上岸！',
    '请问对基础有要求吗？我是跨专业的',
    '报个名，我有去年的资料可以共享',
    '你们一般在哪个教室自习？求带一个',
    '有没有什么推荐的参考书或者网课？',
    '我也卡在这里了，有解决了的吗？',
    '这个思路好棒，我之前怎么就没想到呢',
    '请问一周大概要花多少时间？课多怕应付不来',
    'mark一下，等我忙完这阵子就来',
    '同求！楼主有进展了踢我一下',
    '帮顶，虽然不是同方向的但默默加油',
    '请问完全零基础可以加入吗？',
    '已私聊，我这边有一些资料可以分享',
  ],
  life: [
    '终于有人组这个了！我加我加',
    '四食堂yyds，可惜我一般12点才下课',
    '操场晚上人多不多啊，社恐有点慌',
    '算我一个，我也是一个人懒得动',
    '这个好！正好我也需要',
    '请问对装备有啥要求不？',
    '好欸，我室友可能也想一起',
    '你们一般几点开始？我看一下课表',
    '有兴趣！已私信楼主',
    '同好啊啊啊！终于找到组织了',
  ],
  entertainment: [
    '我也在追这个！最新一集太精彩了',
    '带我一个带我一个，我辅助贼稳',
    '这个阵容真的绝了，必须去！',
    '哈哈哈我也是钻石守门员，求带飞',
    '最近剧荒了，这个好看吗？求真实评价',
    '周末约起！不过我水平比较菜别嫌弃',
    '已买票！到时候可以一起走',
  ],
  skill: [
    '这个互换太棒了！我刚好会你说的那个',
    '想学吉他好久了，请问零基础可以吗',
    '拍得好好看！请问用的什么相机/后期软件',
    '一起学习效率确实高很多，深有体会',
    '我也想学这个，但完全没基础怕拖后腿',
  ],
  general: [
    '支持一下！',
    '请问还有位置吗？',
    '帮顶帮顶～',
    '楼主好积极，加油！',
    '已报名，期待一起！',
  ],
};

// ─── 申请理由数据池 ───
const APPLY_REASONS = {
  study: [
    '我也在准备这个考试，可以一起刷题',
    '同方向！有复习资料可以互换',
    '基础一般但很认真，希望一起进步',
    '看过你的学习计划了，和我的节奏很匹配',
    '之前有过类似的项目经验，可以帮上忙',
  ],
  life: [
    '正好也需要，缘分！',
    '时间地点都合适，求通过～',
    '一个人确实不好坚持，有伴好多了',
    '我也是这个校区的，很方便',
  ],
  entertainment: [
    '同好必须加一个！',
    '刚好闲下来想找人一起玩',
    '看过你的主页，感觉我们挺合拍的',
    '求通过求通过～',
  ],
  skill: [
    '会一点相关技能，可以互相学习',
    '非常想学这个！会认真学的',
    '刚好我会这个，可以交换技能',
  ],
  general: [
    '想加入一起，感觉很有意思',
    '求通过，真心想参与',
    '对这个活动很感兴趣！',
    '希望有机会一起交流',
  ],
};

// ─── 发现帖子数据池 ───
const EXPLORE_POSTS = [
  { title: '【经验分享】软工概论期末复习全攻略', category: 'study', content: '<p>选过王建国老师的软工概论，分享一下期末复习心得：</p><ol><li>重点看软件生命周期各阶段（需求→设计→实现→测试→维护）</li><li>敏捷开发vs瀑布模型的对比必考</li><li>UML图一定要会画，尤其是用例图和类图</li><li>往年题重复率挺高的，建议刷18-24年的</li></ol><p>祝大家期末顺利！</p>' },
  { title: '杜厦图书馆自习环境横评（附实拍）', category: 'study', content: '<p>在杜厦待了三年了，给大家盘点一下各楼层的自习体验：</p><p><strong>2F</strong> 人最多但也最吵，适合小组讨论。</p><p><strong>3F</strong> 安静程度刚好，靠窗位置采光好。</p><p><strong>4F</strong> 最安静，但空调有时候开太猛会冷。</p><p><strong>5F</strong> 期刊阅览区人很少，适合需要极度专注的时候。</p><p>个人推荐3F靠南侧的位置，下午阳光好还不刺眼。</p>' },
  { title: '【求助】学校附近有没有靠谱的打印店', category: 'general', content: '<p>要打印毕设论文终稿了，想找一家排版靠谱、不会乱动格式的打印店。之前在一家打出来的表格全歪了…</p><p>求推荐南大附近靠谱的打印店，最好能支持PDF直接打印不用转格式的。价格贵点无所谓，关键是质量要好。</p>' },
  { title: '大厂实习面经分享（字节/腾讯/阿里）', category: 'social', content: '<p>暑期实习告一段落，分享一下面经回馈社区：</p><p><strong>字节跳动</strong>（后端）：三轮技术面+一轮HR面。手撕代码考了LRU Cache和二叉树层序遍历，系统设计问了一个短链接系统。</p><p><strong>腾讯</strong>（后台开发）：两轮技术面+一轮HR面。问了C++内存管理、TCP拥塞控制、Redis底层数据结构。</p><p><strong>阿里</strong>（Java开发）：两轮+交叉面。重点问了JVM调优和数据库索引优化。</p><p>整体感觉面试官都很好，考察深度大于广度。</p>' },
  { title: '【吐槽】选课系统能不能优化一下', category: 'general', content: '<p>每次选课都像打仗一样，一到点系统就崩。好不容易进去了，课已经满了…</p><p>强烈建议学校把选课服务器扩容一下，或者至少做个排队系统，不要让服务器直接崩溃。这都2026年了，技术手段应该不难吧。</p><p>有同感的顶一下！</p>' },
  { title: '仙林校区美食地图（持续更新）', category: 'social', content: '<p>吃了三年食堂总结出来的美食攻略：</p><p><strong>四食堂</strong> 石锅拌饭（排队王）、酸菜鱼面</p><p><strong>三食堂</strong> 麻辣香锅（自选食材，中辣最香）、黄焖鸡米饭</p><p><strong>一食堂</strong> 早餐的煎饼果子和豆浆是绝配</p><p><strong>清真食堂</strong> 手抓饭和羊肉串都很正宗</p><p>欢迎大家在评论区补充！</p>' },
  { title: '出闲置：数据结构+操作系统教材', category: 'trade', content: '<p>出几本闲置教材，都是几乎全新的：</p><ul><li>《数据结构（C语言版）》严蔚敏 — 8成新，15元</li><li>《现代操作系统》Tanenbaum 英文版 — 9成新，20元</li><li>《数据库系统概论》王珊 — 7成新，10元</li></ul><p>南大仙林校区面交，需要的私聊～</p>' },
  { title: '有没有人想一起搞个校园小程序', category: 'project', content: '<p>我有一个idea：做一个"南大空教室查询"小程序，显示各教学楼当前没有课的空教室，方便找自习位置。</p><p>技术栈打算用微信小程序原生开发，后端用Node.js。已经有课表数据源了。</p><p>寻1-2名队友：前端/小程序方向或后端都可以，UI设计也欢迎！主要是兴趣项目，没有deadline。</p>' },
  { title: '关于远程实习的讨论', category: 'social', content: '<p>最近发现远程实习越来越多了，想和大家讨论一下：远程实习的含金量和线下比会差很多吗？</p><p>我目前拿到一个远程的offer，但担心写在简历上没有线下的有分量。有没有过来人分享一下经验？</p>' },
  { title: '【资源】计算机专业必读书单', category: 'study', content: '<p>整理了一份计算机专业经典书单，按难度分级：</p><p><strong>入门级</strong>：《编码：隐匿在计算机软硬件背后的语言》</p><p><strong>进阶级</strong>：《深入理解计算机系统》（CSAPP）、《算法导论》</p><p><strong>专业级</strong>：《设计数据密集型应用》、《计算机程序的构造和解释》（SICP）</p><p>大家还有推荐的可以在评论补充！</p>' },
];

// ─── 自习邀约数据 ───
const STUDY_INVITES = [
  { title: '期末图书馆冲刺', desc: '期末周一起泡图书馆，互相监督不玩手机', location: '杜厦图书馆3F', max: 5, approval: false },
  { title: '操作系统作业互助', desc: '一起写OS实验，互相debug', location: '计算机系楼实验室', max: 4, approval: false },
  { title: '晨读英语口语', desc: '每天早上7:30-8:00英语晨读，练口语', location: '北大楼草坪', max: 6, approval: true },
  { title: '周末集中自习', desc: '周末全天自习，中午一起吃饭', location: '仙林教学楼II-103', max: 8, approval: false },
  { title: '马原读书会', desc: '一起读《共产党宣言》和《资本论》选段，交流心得', location: '马克思主义学院阅览室', max: 6, approval: true },
];

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(daysAgoMin, daysAgoMax) {
  const now = Date.now();
  const offset = randomInt(daysAgoMin, daysAgoMax) * 24 * 60 * 60 * 1000;
  const jitter = randomInt(0, 23 * 60 * 60 * 1000); // 随机时分秒
  return new Date(now - offset - jitter).toISOString().replace('T', ' ').substring(0, 19);
}

function futureDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// 第一阶段：直接操作数据库 — 创建用户和课程
// ═══════════════════════════════════════════════════════════════

async function phase1_initDB() {
  console.log('\n══════ 第一阶段：初始化用户和课程 ══════\n');

  // 使用 sql.js 打开数据库
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // 简易 database wrapper
  function run(sql, params = []) {
    sqlDb.run(sql, params);
    const id = sqlDb.exec('SELECT last_insert_rowid() AS id');
    const changes = sqlDb.getRowsModified();
    return { lastInsertRowid: id.length ? id[0].values[0][0] : 0, changes };
  }

  function get(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  function all(sql, params = []) {
    const results = sqlDb.exec(sql, params);
    if (results.length === 0) return [];
    return results[0].values.map(row => {
      const obj = {};
      results[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  function save() {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // ─── 检查已有用户数量 ───
  const existingCount = get('SELECT COUNT(*) AS c FROM users').c;
  console.log(`现有用户数：${existingCount}`);

  // 获取现有测试账号（230000001-230000010）
  const existingTestAccounts = all(
    'SELECT id, username, nickname FROM users WHERE username LIKE ? ORDER BY id',
    ['2300000%']
  );
  console.log(`现有测试账号：${existingTestAccounts.length} 个`);

  // ─── 创建 50 个新用户 ───
  const users = [];
  const startId = 230000011;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // 角色分配
  const roles = [];
  for (let i = 0; i < 10; i++) roles.push('poster');       // 高频发布者
  for (let i = 0; i < 30; i++) roles.push('active');        // 活跃参与者
  for (let i = 0; i < 10; i++) roles.push('browser');       // 普通浏览者
  // 随机打乱
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  console.log('创建 50 个新用户...');

  for (let i = 0; i < 50; i++) {
    const id = startId + i;
    const username = `${id}@smail.nju.edu.cn`;
    const nickname = NICKNAMES[i];
    const major = MAJORS[i % MAJORS.length];
    const grade = GRADES[Math.floor(Math.random() * GRADES.length)];
    const mbti = randomPick(MBTIS);
    const gender = randomPick(GENDERS);
    const bioTemplate = randomPick(BIO_TEMPLATES);
    const hobby = randomPick(HOBBIES);
    const bio = bioTemplate.replace('{x}', hobby).replace('{y}', major);
    const streak = randomInt(0, 30);
    const lastCheckin = streak > 0
      ? new Date(Date.now() - randomInt(0, 48) * 60 * 60 * 1000).toISOString().split('T')[0]
      : '';

    run(
      `INSERT INTO users (username, display_name, password_hash, nickname, major, grade,
        email, email_verified, qq, wechat, douyin, avatar_desc, mbti, gender,
        privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers,
        checkin_streak, last_checkin_date, grace_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, ?, ?, 0, ?)`,
      [username, nickname, PASSWORD_HASH, nickname, major, grade,
        username, '', '', '', '', mbti, gender, streak, lastCheckin, now]
    );

    const dbUser = get('SELECT id, username, nickname FROM users WHERE username = ?', [username]);
    users.push({
      ...dbUser,
      role: roles[i],
      major,
      grade,
      mbti,
      gender,
    });
  }

  // ─── 创建 6 门大课 ───
  console.log('创建 6 门大课...');
  const courseIds = [];

  for (const course of COURSES) {
    // 检查课程是否已存在
    const existing = get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL', [course.title]);
    if (existing) {
      console.log(`  课程"${course.title}"已存在，跳过创建`);
      courseIds.push(existing.id);
      continue;
    }

    const result = run(
      `INSERT INTO courses (title, description, owner_id, semester, teacher, big_course_id, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [course.title, course.description, users[0].id, course.semester, course.teacher, now]
    );
    courseIds.push(result.lastInsertRowid);
    console.log(`  ✅ ${course.title} (id=${result.lastInsertRowid})`);
  }

  // ─── 选课分配 ───
  console.log('分配选课关系...');
  const courseMemberMap = {}; // { courseIdx: [userId, ...] }
  for (let ci = 0; ci < 6; ci++) courseMemberMap[ci] = [];

  // 确保每门课都有足够的 poster 用户
  // 先把 poster 均匀分配到各门课
  const posterUsers = users.filter(u => u.role === 'poster');
  for (let ci = 0; ci < 6; ci++) {
    const posterSubset = posterUsers.slice(ci * 2, (ci + 1) * 2); // 每门课至少2个poster
    for (const user of posterSubset) {
      if (user && !courseMemberMap[ci].includes(user.id)) {
        courseMemberMap[ci].push(user.id);
      }
    }
  }

  // 活跃用户随机分配
  const activeUsers = users.filter(u => u.role === 'active');
  for (const user of activeUsers) {
    const numCourses = randomInt(2, 4);
    const picked = randomPickN([0, 1, 2, 3, 4, 5], numCourses);
    for (const ci of picked) {
      if (!courseMemberMap[ci].includes(user.id)) {
        courseMemberMap[ci].push(user.id);
      }
    }
  }

  // 浏览者分配 1-2 门
  const browserUsers = users.filter(u => u.role === 'browser');
  for (const user of browserUsers) {
    const picked = randomPickN([0, 1, 2, 3, 4, 5], randomInt(1, 2));
    for (const ci of picked) {
      if (!courseMemberMap[ci].includes(user.id)) {
        courseMemberMap[ci].push(user.id);
      }
    }
  }

  // 批量插入选课记录
  for (let ci = 0; ci < 6; ci++) {
    for (const userId of courseMemberMap[ci]) {
      run(
        'INSERT OR IGNORE INTO user_courses (user_id, course_id, semester_key) VALUES (?, ?, ?)',
        [userId, courseIds[ci], COURSES[ci].semester]
      );
    }
  }

  // 给原有测试账号也选课
  for (const eu of existingTestAccounts) {
    const picked = randomPickN([0, 1, 2, 3, 4, 5], randomInt(2, 4));
    for (const ci of picked) {
      run(
        'INSERT OR IGNORE INTO user_courses (user_id, course_id, semester_key) VALUES (?, ?, ?)',
        [eu.id, courseIds[ci], COURSES[ci].semester]
      );
      if (!courseMemberMap[ci].includes(eu.id)) {
        courseMemberMap[ci].push(eu.id);
      }
    }
  }

  const totalEnrollments = Object.values(courseMemberMap).reduce((s, a) => s + a.length, 0);
  console.log(`  选课关系：${totalEnrollments} 条（含原有用户）`);

  // ─── 保存数据库 ───
  save();
  sqlDb.close();

  console.log(`\n✅ 第一阶段完成：${users.length} 个新用户 + 6 门课程已写入数据库`);
  console.log(`   密码统一为：${USER_PASSWORD}`);

  return { users, courseIds, existingTestAccounts, courseMemberMap };
}

// ═══════════════════════════════════════════════════════════════
// 第二阶段：通过 API 创建内容
// ═══════════════════════════════════════════════════════════════

function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

async function api(method, url, { token, body, formData } = {}) {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body && !formData) {
    headers['Content-Type'] = 'application/json';
  }

  const opts = { method, headers };
  if (formData) {
    opts.body = formData;
  } else if (body) {
    opts.body = JSON.stringify(body);
  }

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  let response;
  let retries = 0;
  while (retries < 5) {
    try {
      response = await fetch(fullUrl, opts);
      break;
    } catch (e) {
      retries++;
      if (retries >= 5) throw e;
      console.log(`  ⚠ 网络错误，重试 (${retries}/5)...`);
      await sleep(1000);
    }
  }

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!response.ok) {
    throw new Error(`${method} ${url} → ${response.status}: ${data.error || text}`);
  }

  return data;
}

// 创建 dummy 文件用于上传
function createDummyFile(filename, content, dir) {
  const fullDir = path.join(__dirname, dir);
  fs.mkdirSync(fullDir, { recursive: true });
  const filepath = path.join(fullDir, filename);
  fs.writeFileSync(filepath, content);
  return filepath;
}

function createMinimalPDF() {
  // 最小有效 PDF
  return Buffer.from(
    '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
    'utf-8'
  );
}

function createMinimalPNG() {
  // 1x1 像素 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

async function phase2_seedContent(users, courseIds, existingTestAccounts, courseMemberMap) {
  console.log('\n══════ 第二阶段：通过 API 填充内容 ══════\n');

  // ─── 准备 token 映射 ───
  const tokens = {};
  // 新创建的用户
  for (const user of users) {
    tokens[user.id] = generateToken(user.id, user.username);
  }
  // 原有测试账号也生成 token
  for (const eu of existingTestAccounts) {
    tokens[eu.id] = generateToken(eu.id, eu.username);
  }

  // 合并所有用户
  const allUsers = [...users];
  const testAccountMap = {};
  for (const eu of existingTestAccounts) {
    allUsers.push({ id: eu.id, username: eu.username, nickname: eu.nickname, role: 'active' });
    testAccountMap[eu.id] = eu;
  }

  // 找到第一个原有测试账号用于后续操作
  const firstTestAccount = existingTestAccounts[0];
  const testToken = firstTestAccount ? tokens[firstTestAccount.id] : null;

  // ─── 角色分组 ───
  const posters = users.filter(u => u.role === 'poster');
  const actives = users.filter(u => u.role === 'active');
  const browsers = users.filter(u => u.role === 'browser');

  console.log(`角色分布：发布者 ${posters.length} / 活跃者 ${actives.length} / 浏览者 ${browsers.length}`);
  console.log(`原有测试账号：${existingTestAccounts.length} 个`);

  // 辅助：根据课程索引获取已选课用户
  function getEnrolledForCourse(courseIdx) {
    const ids = courseMemberMap[courseIdx] || [];
    return users.filter(u => ids.includes(u.id));
  }

  // 辅助：根据 courseId 获取已选课用户
  function getEnrolledForCourseId(courseId) {
    const ci = courseIds.indexOf(courseId);
    return ci >= 0 ? getEnrolledForCourse(ci) : [...posters, ...actives];
  }

  // ═══════════════════════════════════════════
  // 2.1 搭子帖（40条）
  // ═══════════════════════════════════════════
  console.log('\n─── 创建搭子帖（40条）───');

  const allSquarePosts = []; // { id, postId, courseId, type: 'course'|'global', creatorId }
  let sqIdx = 0;

  for (const sp of SQUARE_POSTS) {
    sqIdx++;
    // 课程帖：从该课程的注册用户中选发布者；全局帖：随机选
    let poster;
    if (sp.type === 'course') {
      const enrolled = courseMemberMap[sp.courseIdx] || [];
      // 优先选 poster 角色的已选课用户，否则选任意已选课用户
      const enrolledPosters = posters.filter(p => enrolled.includes(p.id));
      poster = enrolledPosters.length > 0 ? randomPick(enrolledPosters) : users.find(u => enrolled.includes(u.id));
      if (!poster) poster = posters[sqIdx % posters.length]; // fallback
    } else {
      poster = posters[sqIdx % posters.length];
    }
    const token = tokens[poster.id];

    // 计算过期时间（3-30 天）
    const expiresDays = randomInt(3, 30);
    const expiresAt = futureDate(expiresDays);

    // 发布时间（1-30 天前）
    const createdAt = randomDate(1, 30);

    try {
      let result;
      if (sp.type === 'course') {
        const courseId = courseIds[sp.courseIdx];
        result = await api('POST', `/api/courses/${courseId}/square-posts`, {
          token,
          body: { title: sp.title, category: sp.category, description: sp.desc, max_people: sp.max },
        });
        allSquarePosts.push({
          id: result.id || result.postId,
          courseId,
          type: 'course',
          creatorId: poster.id,
          max_people: sp.max,
          status: 'open',
          category: sp.category,
        });
      } else {
        result = await api('POST', '/api/square/posts', {
          token,
          body: { title: sp.title, category: sp.category, description: sp.desc, max_people: sp.max },
        });
        allSquarePosts.push({
          id: result.id || result.postId,
          courseId: null,
          type: 'global',
          creatorId: poster.id,
          max_people: sp.max,
          status: 'open',
          category: sp.category,
        });
      }
      process.stdout.write(`  [${sqIdx}/40] ${sp.title.substring(0, 20)}... ✅\r`);
    } catch (e) {
      console.log(`\n  ❌ 失败: ${sp.title} — ${e.message}`);
    }

    // 小延迟避免触发频率限制
    if (sqIdx % 10 === 0) await sleep(500);
  }
  console.log('\n  搭子帖创建完成');

  // ═══════════════════════════════════════════
  // 2.2 申请记录（~120条）
  // ═══════════════════════════════════════════
  console.log('\n─── 创建申请记录 ───');

  let applyCount = 0;
  const openPosts = allSquarePosts.filter(p => p.status === 'open');

  for (const post of openPosts) {
    const numApplicants = randomInt(2, 5);
    // 课程帖只从已选课用户中选申请者；全局帖随意
    const applicantPool = post.type === 'course'
      ? getEnrolledForCourseId(post.courseId).filter(u => u.id !== post.creatorId)
      : actives.filter(u => u.id !== post.creatorId);
    const applicants = randomPickN(applicantPool.length > 0 ? applicantPool : users.filter(u => u.role === 'active'), numApplicants);

    let confirmedCount = 0;
    for (const applicant of applicants) {
      const token = tokens[applicant.id];
      const reason = randomPick(APPLY_REASONS[['study', 'life', 'entertainment', 'skill', 'general'][randomInt(0, 4)]]);

      try {
        // 表达兴趣
        let interestResult;
        if (post.type === 'course') {
          interestResult = await api('POST', `/api/courses/${post.courseId}/square-posts/${post.id}/interest`, { token });
        } else {
          interestResult = await api('POST', `/api/square/posts/${post.id}/interest`, { token });
        }

        // 决定状态：50% 待确认，35% 已通过，15% 已拒绝
        const rand = Math.random();
        if (rand < 0.35 && confirmedCount < post.max_people) {
          // 通过
          const interestId = interestResult.id || interestResult.interestId;
          if (interestId) {
            const creatorToken = tokens[post.creatorId];
            if (post.type === 'course') {
              await api('PUT', `/api/courses/${post.courseId}/square-interests/${interestId}`, {
                token: creatorToken, body: { action: 'accept' },
              });
            } else {
              await api('PUT', `/api/square/interests/${interestId}`, {
                token: creatorToken, body: { action: 'accept' },
              });
            }
            confirmedCount++;
          }
        } else if (rand < 0.50) {
          // 拒绝
          const interestId = interestResult.id || interestResult.interestId;
          if (interestId) {
            const creatorToken = tokens[post.creatorId];
            if (post.type === 'course') {
              await api('PUT', `/api/courses/${post.courseId}/square-interests/${interestId}`, {
                token: creatorToken, body: { action: 'reject' },
              });
            } else {
              await api('PUT', `/api/square/interests/${interestId}`, {
                token: creatorToken, body: { action: 'reject' },
              });
            }
          }
        }
        // else: 保持 pending

        applyCount++;
      } catch (e) {
        // 忽略申请错误（可能已存在）
      }
    }

    // 更新帖子状态（如果满员或需要标记为已结束）
    if (confirmedCount >= post.max_people) {
      post.status = 'full';
    }
  }
  console.log(`  完成：${applyCount} 条申请记录`);

  // 随机设置 8 条帖子为已满员、8 条为已结束
  // 已在上面的处理中部分完成，这里补充设置
  const fullPosts = allSquarePosts.filter(p => p.status === 'full');
  const toFull = Math.max(0, 8 - fullPosts.length);
  const candidatesForFull = allSquarePosts.filter(p => p.status === 'open');
  for (let i = 0; i < Math.min(toFull, candidatesForFull.length); i++) {
    candidatesForFull[i].status = 'full';
  }

  // ═══════════════════════════════════════════
  // 2.3 评论（~200条）
  // ═══════════════════════════════════════════
  console.log('\n─── 创建评论回复 ───');

  let commentCount = 0;
  const allComments = []; // { id, postId, type: 'course_square'|'square', authorId }

  for (const post of allSquarePosts) {
    const numComments = randomInt(3, 10);
    // 课程帖只从已选课用户中选评论者；全局帖随意
    const commentPool = post.type === 'course'
      ? getEnrolledForCourseId(post.courseId).filter(u => u.id !== post.creatorId)
      : [...actives, ...posters, ...browsers].filter(u => u.id !== post.creatorId);
    const commentators = randomPickN(commentPool.length > 0 ? commentPool : [...actives, ...posters, ...browsers], numComments);

    let postComments = [];

    for (const commentator of commentators) {
      const token = tokens[commentator.id];

      // 根据帖子分类选择评论池
      const poolKey = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '竞赛组队'].includes(post.category) ? 'study'
                    : ['技能交换'].includes(post.category) ? 'skill'
                    : randomPick(['life', 'entertainment', 'general']);
      const commentContent = randomPick(COMMENT_POOLS[poolKey]);

      try {
        let result;
        if (post.type === 'course') {
          result = await api('POST', `/api/courses/${post.courseId}/square-posts/${post.id}/comments`, {
            token, body: { content: commentContent },
          });
        } else {
          result = await api('POST', `/api/square/posts/${post.id}/comments`, {
            token, body: { content: commentContent },
          });
        }

        const commentId = result.id || result.commentId;
        if (commentId) {
          postComments.push({ id: commentId, authorId: commentator.id });
          allComments.push({ id: commentId, postId: post.id, type: post.type === 'course' ? 'course_square' : 'square', authorId: commentator.id });
          commentCount++;
        }
      } catch (e) {
        // 忽略评论错误
      }
    }

    // 30% 的评论有二级回复
    if (postComments.length > 0) {
      const replyCount = Math.max(1, Math.floor(postComments.length * 0.3));
      const toReply = randomPickN(postComments, replyCount);

      for (const parentComment of toReply) {
        const replyAuthor = randomPick([...actives, ...posters].filter(u => u.id !== parentComment.authorId));
        const token = tokens[replyAuthor.id];
        const replyContent = randomPick([
          '同意！我也是这么觉得的',
          '有道理，补充一下...',
          '好的好的，私聊你了',
          '求详细说说！',
          '这个我也经历过，慢慢来就好',
          '可以可以，带我一个',
          '谢谢分享！很有帮助',
          '有被安利到！',
          '+1，同款感受',
        ]);

        try {
          const result = await api('POST',
            post.type === 'course'
              ? `/api/courses/${post.courseId}/square-posts/${post.id}/comments`
              : `/api/square/posts/${post.id}/comments`,
            { token, body: { content: replyContent, parent_id: parentComment.id } }
          );
          if (result.id || result.commentId) {
            commentCount++;
          }
        } catch (e) {
          // 忽略
        }
      }
    }
  }
  console.log(`  完成：${commentCount} 条评论（含楼中楼）`);

  // ═══════════════════════════════════════════
  // 2.4 课程论坛帖子 + 评论
  // ═══════════════════════════════════════════
  console.log('\n─── 创建课程论坛帖子 ───');

  const forumPosts = [
    { courseIdx: 0, title: '软工概论第一章重点整理', content: '整理了第一章的思维导图，包括软件工程定义、软件过程模型概述、敏捷宣言等核心概念。需要的同学自取～有不对的地方欢迎指正。' },
    { courseIdx: 0, title: 'UML用例图到底怎么画才规范？', content: '看了教材和PPT，感觉用例图的规范说法不太统一。有的说椭圆里写动名词，有的说写动词短语。有没有学长学姐分享一下考试时到底按哪个标准？' },
    { courseIdx: 1, title: '分享一个红黑树可视化网站', content: 'https://www.cs.usfca.edu/~galles/visualization/RedBlack.html 这个网站可以一步步看红黑树的插入和旋转过程，比干看书直观多了。期末复习的时候发现的神器。' },
    { courseIdx: 1, title: 'Dijkstra算法的手算技巧', content: '考试会考Dijkstra的手算过程，分享一下我的方法：先画表格，行是迭代次数，列是每个节点的当前最短距离和前置节点。按部就班填写就不会乱。附了例题解析。' },
    { courseIdx: 2, title: '进程调度实验参考代码（Python版）', content: '写了一个简单的FCFS + SJF + RR调度模拟器，命令行可以切换算法和参数。代码放在了GitHub上，需要的自取。欢迎提issue和PR～' },
    { courseIdx: 2, title: '死锁避免（银行家算法）疑问', content: '做课后题碰到一个情况：如果某个进程的Need小于Work但是Request大于Work，这时能不能分配？教材上好像没明确说这种情况。' },
    { courseIdx: 3, title: '数据库范式分解步骤总结', content: '整理了1NF→2NF→3NF→BCNF的分解步骤和判断方法。关键是要先找出所有函数依赖，然后判断主属性。附了5道例题。' },
    { courseIdx: 3, title: 'MySQL索引优化实战经验', content: '最近在做一个课程项目，发现加了索引后查询反而变慢了。排查发现是因为索引选择性太低（性别字段）。分享一下索引优化的几个踩坑经验。' },
    { courseIdx: 4, title: '英语pre演讲稿求修改意见', content: '下周二要做pre了，主题是"The Impact of AI on Education"。写了初稿但感觉表达不够地道。有没有英语好的同学帮忙看看？附了Google Docs链接。' },
    { courseIdx: 5, title: '唯物主义辩证法梳理', content: '把教材前三章的重点梳理了一下：唯物论→辩证法→认识论→唯物史观这条线。做了个思维导图，赵老师班的同学可以参考。但以老师课上讲的为准。' },
  ];

  let forumCommentCount = 0;
  for (const fp of forumPosts) {
    const courseId = courseIds[fp.courseIdx];
    // 从该课程的注册用户中选发布者
    const enrolled = courseMemberMap[fp.courseIdx] || [];
    const enrolledPosters = posters.filter(p => enrolled.includes(p.id));
    const author = enrolledPosters.length > 0 ? randomPick(enrolledPosters)
                 : enrolled.length > 0 ? users.find(u => enrolled.includes(u.id)) || randomPick([...posters, ...actives])
                 : randomPick([...posters, ...actives]);
    if (!author) continue;
    const token = tokens[author.id];

    try {
      const result = await api('POST', `/api/courses/${courseId}/posts`, {
        token,
        body: { title: fp.title, content: fp.content },
      });
      const postId = result.id || result.postId;

      if (postId) {
        // 添加 3-5 条评论
        const numReplies = randomInt(3, 5);
        const repliers = randomPickN([...actives, ...posters], numReplies);
        let parentCommentId = null;

        for (const replier of repliers) {
          const rtoken = tokens[replier.id];
          const replyContent = randomPick(COMMENT_POOLS.study);
          try {
            const cr = await api('POST', `/api/courses/posts/${postId}/comments`, {
              token: rtoken,
              body: { content: replyContent, parent_id: parentCommentId || undefined },
            });
            if (!parentCommentId && (cr.id || cr.commentId)) {
              parentCommentId = cr.id || cr.commentId;
            }
            forumCommentCount++;
          } catch (e) { /* ignore */ }
        }
      }
      process.stdout.write(`  ✅ ${fp.title.substring(0, 30)}...\r`);
    } catch (e) {
      console.log(`\n  ❌ 论坛帖失败: ${fp.title} — ${e.message}`);
    }
  }
  console.log(`\n  完成：${forumPosts.length} 条论坛帖 + ${forumCommentCount} 条评论`);

  // ═══════════════════════════════════════════
  // 2.5 学习资料（20份）+ 评分
  // ═══════════════════════════════════════════
  console.log('\n─── 上传学习资料 ───');

  const materialDefs = [
    // 期末真题 (5)
    { courseIdx: 0, title: '软件工程概论 2024 期末真题（回忆版）', desc: '含选择、填空、简答和综合题，部分有参考答案', category: '真题', chapter: '综合' },
    { courseIdx: 1, title: '数据结构 2023-2024 期末真题汇编', desc: '共5套真题，含详细解析和代码实现', category: '真题', chapter: '综合' },
    { courseIdx: 2, title: '操作系统 2024 期末试题（A卷）', desc: '含PV操作、进程调度、内存管理等重点题型', category: '真题', chapter: '综合' },
    { courseIdx: 3, title: '数据库原理 2023 期末B卷真题', desc: '重点考察SQL语句、范式分解和ER图', category: '真题', chapter: '综合' },
    { courseIdx: 5, title: '马克思主义基本原理 2024 期末真题', desc: '选择题+简答题+论述题，论述题部分有答题思路', category: '真题', chapter: '综合' },
    // 课堂笔记 (5)
    { courseIdx: 0, title: '软工概论 1-8章 课堂笔记（手写整理）', desc: '基于王建国老师课堂讲解整理，重点突出', category: '笔记', chapter: '第1-8章' },
    { courseIdx: 1, title: '数据结构 树与图 章节笔记', desc: '二叉树、BST、AVL、B树、图遍历、最短路径笔记', category: '笔记', chapter: '第5-7章' },
    { courseIdx: 2, title: '操作系统 内存管理+文件系统笔记', desc: '分页、分段、虚拟内存、文件系统结构详细笔记', category: '笔记', chapter: '第3-4章' },
    { courseIdx: 3, title: '数据库 SQL语法速查笔记', desc: 'DDL/DML/DCL常用语句速查表，含示例', category: '笔记', chapter: '第2-3章' },
    { courseIdx: 4, title: '大学英语（四）课堂笔记合集', desc: '包含每单元重点词汇、句型和写作模板', category: '笔记', chapter: '全册' },
    // 课件PPT (5)
    { courseIdx: 0, title: '软工概论 敏捷开发与Scrum 课件', desc: '王老师第5-6讲的完整PPT，含案例', category: '课件', chapter: '第5章' },
    { courseIdx: 1, title: '数据结构 排序算法 完整课件', desc: '冒泡、快排、归并、堆排序的比较与分析', category: '课件', chapter: '第8章' },
    { courseIdx: 2, title: '操作系统 进程同步与互斥 课件', desc: '信号量机制、经典同步问题详解', category: '课件', chapter: '第2章' },
    { courseIdx: 3, title: '数据库 事务与并发控制 课件', desc: 'ACID特性、封锁协议、死锁处理', category: '课件', chapter: '第5章' },
    { courseIdx: 5, title: '马原 政治经济学 课件精华版', desc: '剩余价值理论、资本积累、经济危机部分', category: '课件', chapter: '第4-5章' },
    // 复习提纲 (5)
    { courseIdx: 0, title: '软件工程概论 期末复习提纲', desc: '按章节整理的复习要点和常见考点', category: '其他', chapter: '综合' },
    { courseIdx: 1, title: '数据结构 期末考点梳理', desc: '各章节分值占比分析和重点题型预测', category: '其他', chapter: '综合' },
    { courseIdx: 2, title: '操作系统 考前必看知识点', desc: '高频考点浓缩，适合考前一天快速过一遍', category: '其他', chapter: '综合' },
    { courseIdx: 3, title: '数据库原理 期末复习清单', desc: '包含所有SQL语法、范式判断步骤和ER图规则', category: '其他', chapter: '综合' },
    { courseIdx: 4, title: '大学英语（四）写作模板', desc: '议论文、书信、报告的万能模板和常用句型', category: '其他', chapter: '写作' },
  ];

  const materialIds = [];
  const dummyPDF = createMinimalPDF();
  const uploadsDir = path.join(__dirname, 'uploads', 'materials');

  for (const mat of materialDefs) {
    const courseId = courseIds[mat.courseIdx];
    // 从已选课用户中选上传者
    const matUploaders = getEnrolledForCourse(mat.courseIdx);
    const uploader = matUploaders.length > 0 ? randomPick(matUploaders) : randomPick([...posters, ...actives]);
    const token = tokens[uploader.id];

    // 创建临时文件用于上传
    const filename = `${mat.title.replace(/[\/\\:*?"<>|]/g, '_')}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, dummyPDF);

    try {
      const fileBuffer = fs.readFileSync(filepath);
      const file = new File([fileBuffer], filename, { type: 'application/pdf' });
      const fd = new FormData();
      fd.append('file', file, filename);
      fd.append('title', mat.title);
      fd.append('description', mat.desc);
      fd.append('category', mat.category);
      fd.append('chapter', mat.chapter);

      const response = await fetch(`${BASE_URL}/api/materials/courses/${courseId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });

      const result = await response.json();
      if (response.ok && (result.id || result.materialId)) {
        materialIds.push({ id: result.id || result.materialId, courseId });
      }
    } catch (e) {
      // 文件上传失败静默处理
    }

    // 清理临时文件
    if (fs.existsSync(filepath)) {
      // 保留文件，因为已经被 multer 复制了
    }
  }

  // 为部分资料添加评分
  console.log('  添加资料评分...');
  let ratingCount = 0;
  for (const mat of materialIds.slice(0, 15)) {
    const raters = randomPickN([...actives, ...browsers, ...posters], randomInt(1, 4));
    for (const rater of raters) {
      try {
        await api('POST', `/api/materials/${mat.id}/rate`, {
          token: tokens[rater.id],
          body: { rating: randomInt(3, 5) },
        });
        ratingCount++;
      } catch (e) { /* ignore */ }
    }
  }
  console.log(`  完成：${materialDefs.length} 份资料 + ${ratingCount} 条评分`);

  // ═══════════════════════════════════════════
  // 2.6 发现模块帖子
  // ═══════════════════════════════════════════
  console.log('\n─── 创建发现帖子 ───');

  let exploreCommentCount = 0;
  const explorePostIds = [];

  for (const ep of EXPLORE_POSTS) {
    const author = randomPick([...posters, ...actives]);
    const token = tokens[author.id];

    try {
      const result = await api('POST', '/api/explore/posts', {
        token,
        body: {
          title: ep.title,
          category: ep.category,
          content: JSON.stringify([{ type: 'text', data: ep.content }]),
        },
      });
      const postId = result.id || result.postId;
      if (postId) {
        explorePostIds.push(postId);

        // 3-5 条评论
        const numReplies = randomInt(3, 5);
        const repliers = randomPickN([...actives, ...posters, ...browsers], numReplies);
        let parentId = null;

        for (const replier of repliers) {
          const rtoken = tokens[replier.id];
          const replyContent = randomPick(COMMENT_POOLS.general);
          try {
            const cr = await api('POST', `/api/explore/posts/${postId}/comments`, {
              token: rtoken,
              body: { content: replyContent, parent_id: parentId || undefined },
            });
            if (!parentId && (cr.id || cr.commentId)) parentId = cr.id || cr.commentId;
            exploreCommentCount++;
          } catch (e) { /* ignore */ }
        }
      }
      process.stdout.write(`  ✅ ${ep.title.substring(0, 30)}...\r`);
    } catch (e) {
      console.log(`\n  ❌ 发现帖失败: ${ep.title} — ${e.message}`);
    }
  }
  console.log(`\n  完成：${EXPLORE_POSTS.length} 条发现帖 + ${exploreCommentCount} 条评论`);

  // ═══════════════════════════════════════════
  // 2.7 自习邀约
  // ═══════════════════════════════════════════
  console.log('\n─── 创建自习邀约 ───');

  const startDate = new Date();
  let inviteCount = 0;

  for (let i = 0; i < STUDY_INVITES.length; i++) {
    const si = STUDY_INVITES[i];
    const creator = randomPick([...posters, ...actives]);
    const token = tokens[creator.id];
    const courseId = courseIds[randomInt(0, 5)];

    const studyDate = new Date(startDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
    const dateStr = studyDate.toISOString().split('T')[0];

    try {
      const result = await api('POST', '/api/invites', {
        token,
        body: {
          course_id: courseId,
          title: si.title,
          description: si.desc,
          study_date: dateStr,
          start_time: i < 2 ? '14:00' : '07:30',
          end_time: i < 2 ? '17:00' : '11:30',
          location: si.location,
          max_participants: si.max,
          approval_required: si.approval,
        },
      });
      const inviteId = result.id || result.inviteId;

      // 其他用户加入
      if (inviteId) {
        inviteCount++;
        const joiners = randomPickN(actives, Math.min(si.max - 1, randomInt(1, 3)));
        for (const joiner of joiners) {
          try {
            await api('POST', `/api/invites/${inviteId}/respond`, {
              token: tokens[joiner.id],
              body: { action: 'join' },
            });
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      console.log(`  ❌ 邀约失败: ${si.title} — ${e.message}`);
    }
  }
  console.log(`  完成：${inviteCount} 条自习邀约`);

  // ═══════════════════════════════════════════
  // 2.8 关注关系
  // ═══════════════════════════════════════════
  console.log('\n─── 创建关注关系 ───');

  let followCount = 0;
  for (const user of [...posters, ...actives]) {
    const toFollow = randomPickN(
      [...posters, ...actives, ...browsers].filter(u => u.id !== user.id),
      randomInt(1, 5)
    );
    for (const target of toFollow) {
      try {
        await api('POST', `/api/user/${target.id}/follow`, { token: tokens[user.id] });
        followCount++;
      } catch (e) { /* ignore */ }
    }
  }
  console.log(`  完成：${followCount} 条关注关系`);

  // ═══════════════════════════════════════════
  // 2.9 收藏
  // ═══════════════════════════════════════════
  console.log('\n─── 创建收藏 ───');

  let favCount = 0;
  for (const user of randomPickN(browsers, 10)) {
    // 收藏课程
    const favCourses = randomPickN(courseIds, randomInt(1, 3));
    for (const cid of favCourses) {
      try {
        await api('POST', `/api/favorites/courses/${cid}`, { token: tokens[user.id] });
        favCount++;
      } catch (e) { /* ignore */ }
    }
  }
  console.log(`  完成：${favCount} 条收藏`);

  // ═══════════════════════════════════════════
  // 2.10 测试账号签到
  // ═══════════════════════════════════════════
  console.log('\n─── 测试账号签到 ───');

  // 为第一个测试账号签到
  if (firstTestAccount && testToken) {
    try {
      for (let d = 7; d >= 0; d--) {
        const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await api('POST', '/api/auth/checkin', { token: testToken, body: { date } });
      }
      console.log(`  ✅ 测试账号 ${firstTestAccount.username} 连续签到 8 天`);
    } catch (e) {
      console.log(`  ⚠ 签到部分失败: ${e.message}`);
    }
  } else {
    console.log('  ⚠ 未找到原有测试账号，跳过签到');
  }

  // ═══════════════════════════════════════════
  // 2.11 为测试账号生成通知（直接写DB）
  // ═══════════════════════════════════════════
  console.log('\n─── 为测试账号生成通知 ───');

  if (firstTestAccount) {
    // 直接用 sql.js 插入通知（服务器已运行，改DB后需重启才能看到）
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(DB_PATH);
    const sdb = new SQL.Database(buf);

    const now = Date.now();
    const testUserId = firstTestAccount.id;
    const notifs = [
      { type: 'new_comment', title: '新评论', message: '图书馆常驻人口 评论了你的搭子帖「软工期末抱佛脚小组」', related_type: 'course_square_post', related_id: 1 },
      { type: 'comment_reply', title: '评论回复', message: '算法练习生 回复了你在「考研408组队刷题」下的评论', related_type: 'square_post', related_id: 2 },
      { type: 'square_interest', title: '新的搭子申请', message: '快乐女大学生 想加入你的搭子「软工设计模式讨论组」', related_type: 'course_square_post', related_id: 3 },
      { type: 'square_accepted', title: '申请已通过', message: '你的搭子申请「英语四小组pre搭子」已被通过', related_type: 'course_square_post', related_id: 4 },
      { type: 'new_comment', title: '新评论', message: '早八终结者 评论了你的发现帖「大厂实习面经分享」', related_type: 'explore_post', related_id: 1 },
      { type: 'comment_reply', title: '评论回复', message: '摸鱼大队长 回复了你在课程资料下的评论', related_type: 'post', related_id: 1 },
      { type: 'square_interest', title: '新的搭子申请', message: '南大在逃卷王 想加入你的搭子「六级刷分小组」', related_type: 'square_post', related_id: 5 },
      { type: 'square_accepted', title: '申请已通过', message: '你的搭子申请「教资备考小分队」已被通过', related_type: 'square_post', related_id: 6 },
      { type: 'new_follower', title: '新关注', message: '算法练习生 关注了你', related_type: 'user', related_id: 2 },
      { type: 'new_material', title: '新资料上传', message: '数据库原理课程上传了新资料「SQL语法速查笔记」', related_type: 'material', related_id: 1 },
      { type: 'new_comment', title: '新评论', message: '咖啡续命中 评论了你在广场的搭子帖', related_type: 'square_post', related_id: 7 },
      { type: 'comment_reply', title: '评论回复', message: '期末生存者 回复了你在「仙林校区美食地图」下的评论', related_type: 'explore_post', related_id: 2 },
      { type: 'invite_join', title: '邀约加入', message: '代码敲到天亮 加入了你的自习邀约「期末图书馆冲刺」', related_type: 'invite', related_id: 1 },
      { type: 'invite_accepted', title: '邀约通过', message: '你的自习邀约申请「周末集中自习」已被通过', related_type: 'invite', related_id: 2 },
      { type: 'square_interest', title: '新的搭子申请', message: '考研气氛组 想加入你的搭子「考研408组队刷题」', related_type: 'square_post', related_id: 8 },
    ];

    const allCourseIds = all('SELECT id FROM courses WHERE big_course_id IS NULL', []);

    for (let i = 0; i < notifs.length; i++) {
      const n = notifs[i];
      const daysAgo = Math.floor(i / 3);
      const hoursAgo = (i % 3) * 8;
      const ts = new Date(now - daysAgo * 86400000 - hoursAgo * 3600000).toISOString().replace('T', ' ').substring(0, 19);
      const isRead = i < 10 ? 1 : 0; // 前10条已读，后5条未读（显示蓝点）

      sdb.run(
        'INSERT INTO notifications (user_id, type, title, message, related_type, related_id, course_id, is_read, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [testUserId, n.type, n.title, n.message, n.related_type, n.related_id,
         allCourseIds.length > 0 ? allCourseIds[i % allCourseIds.length].id : null,
         isRead, ts]
      );
    }

    const data = sdb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    sdb.close();
    console.log(`  ✅ 为 ${firstTestAccount.username} 生成了 ${notifs.length} 条通知（10已读 + 5未读）`);
  }

  console.log('\n══════ 第二阶段完成 ══════\n');
}

// ═══════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   课搭子 演示数据填充脚本           ║');
  console.log('╚══════════════════════════════════════╝');

  // 第一阶段：直接操作数据库
  const { users, courseIds, existingTestAccounts, courseMemberMap } = await phase1_initDB();

  // 启动服务器
  console.log('\n══════ 启动服务器 ══════');
  console.log(`启动服务器: ${BASE_URL}`);

  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // 等待服务器就绪
  let serverOutput = '';
  serverProcess.stdout.on('data', (data) => {
    serverOutput += data.toString();
  });
  serverProcess.stderr.on('data', (data) => {
    serverOutput += data.toString();
  });

  // 轮询等待服务器启动
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const resp = await fetch(BASE_URL);
      if (resp.ok || resp.status === 401 || resp.status === 404) {
        serverReady = true;
        break;
      }
    } catch (e) {
      // 服务器还没准备好
    }
    await sleep(1000);
  }

  if (!serverReady) {
    console.error('❌ 服务器启动超时，请手动启动服务器后重新运行脚本');
    serverProcess.kill();
    process.exit(1);
  }

  console.log('✅ 服务器就绪\n');

  // 第二阶段：通过 API 填充内容
  try {
    await phase2_seedContent(users, courseIds, existingTestAccounts, courseMemberMap);
  } catch (e) {
    console.error('❌ 数据填充出错:', e.message);
    console.error(e.stack);
  }

  console.log('\n══════════════════════════════════════');
  console.log('  演示数据填充完成！');
  console.log(`  服务器地址: ${BASE_URL}`);
  console.log('  按 Ctrl+C 停止服务器');
  console.log('══════════════════════════════════════\n');

  // 保持服务器运行
  process.on('SIGINT', () => {
    console.log('\n停止服务器...');
    serverProcess.kill('SIGINT');
    process.exit();
  });
}

main().catch(e => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
