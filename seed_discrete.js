/**
 * seed_discrete.js — 离散数学课程演示数据填充
 * node seed_discrete.js
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');

const SECRET = process.env.JWT_SECRET || '';
const BASE = 'http://localhost:3000';
const COURSE_ID = 122;

function tk(uid, uname) {
  return jwt.sign({ userId: uid, username: uname }, SECRET, { expiresIn: '7d' });
}

function pick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  // Load enrolled users
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('db/eduspace.db');
  const db = new SQL.Database(buf);
  const enrolled = db.exec(
    'SELECT u.id, u.username, u.nickname FROM user_courses uc JOIN users u ON uc.user_id = u.id WHERE uc.course_id = ' + COURSE_ID
  );
  const userList = enrolled[0].values.map(r => ({ id: r[0], username: r[1], nickname: r[2] }));
  db.close();
  console.log('Enrolled users:', userList.length);

  // ═══════════════════ 1. Forum Posts ═══════════════════
  console.log('\n--- 论坛帖子 ---');
  const posts = [
    { title: '命题逻辑真值表有没有什么速算技巧', content: '做课后题的时候感觉真值表列起来太慢了，尤其是变量多的时候。有没有什么简化方法？比如不列完整真值表直接判断重言式？求大佬指点！' },
    { title: '集合论容斥原理卡住了', content: '三个集合的容斥原理还好理解，但四个以上集合的公式太长了记不住。有没有什么图形化或者直观的理解方式？韦恩图超过三个集合也不好画了。' },
    { title: '等价关系和偏序关系的判定有没有口诀', content: '总是搞混等价关系的自反对称传递和偏序关系的自反反对称传递。特别是反对称性，和对称性一对比就晕。有没有好记的口诀或者技巧？' },
    { title: '图论Dijkstra算法手算经验分享', content: '考过的学长学姐分享一下，考试的时候Dijkstra算法是要求写出完整表格过程还是只要画最终最短路径树就行？手算的时候有什么容易出错的地方吗？' },
    { title: '离散数学期末重点梳理（李言辉老师班）', content: '整理了李老师这学期讲的重点：命题逻辑（等价变换、范式）、集合论（包含排斥原理）、关系（等价&偏序）、图论（最短路径、欧拉/哈密顿）、代数系统（群论基础）。有遗漏的大家补充～' },
    { title: '课后作业第5章第3题求讲解', content: '题目要求证明R是等价关系并画出等价类。我写了自反和对称的证明，但传递性那块卡住了。不知道从哪一步开始推导，求大佬一步步讲解一下。' },
  ];

  const forumPostIds = [];
  for (const p of posts) {
    const author = pick(userList, 1)[0];
    try {
      const r = await fetch(BASE + '/api/courses/' + COURSE_ID + '/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk(author.id, author.username) },
        body: JSON.stringify({ title: p.title, content: p.content }),
      });
      const d = await r.json();
      if (r.ok) { forumPostIds.push(d.id || d.postId); process.stdout.write('.'); }
      else console.log('  Post fail:', d.error);
    } catch(e) { console.log('  Error:', e.message); }
  }
  console.log(' Posts:', forumPostIds.length);

  // Forum comments
  const commentPool = [
    '顶一个！我也是这块比较薄弱', '谢谢分享，很有帮助', '同问，求大佬解答',
    '我有个更简单的办法，私聊你了', 'mark一下，等大佬回复', '考过的学长学姐求现身',
    '这个确实容易搞混，建议多看几道例题', '你可以看看教材P123的例题，讲得很清楚',
    '我整理了相关的笔记，需要的话可以分享', '同班帮顶！',
  ];
  let fCommentCount = 0;
  for (const pid of forumPostIds) {
    const num = 3 + Math.floor(Math.random() * 4);
    const commenters = pick(userList, num);
    let parentId = null;
    for (const c of commenters) {
      try {
        const r = await fetch(BASE + '/api/courses/posts/' + pid + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk(c.id, c.username) },
          body: JSON.stringify({ content: pick(commentPool, 1)[0], parent_id: parentId || undefined }),
        });
        const d = await r.json();
        if (r.ok) { fCommentCount++; if (!parentId && (d.id || d.commentId)) parentId = d.id || d.commentId; }
      } catch(e) {}
    }
  }
  console.log(' Forum comments:', fCommentCount);

  // ═══════════════════ 2. Square Posts ═══════════════════
  console.log('\n--- 搭子帖 ---');
  const squarePosts = [
    { title: '离散数学期末复习小组', desc: '寻找2-3个同学一起复习离散数学期末，计划每周刷两章课后题。李言辉老师班的最好，其他班也欢迎。我整理了前四章的思维导图可以共享。', category: '项目组队', max: 3 },
    { title: '离散数学作业互助群', desc: '每周作业互相检查对答案，重点讨论证明题。目前是两个人，再招2个。要求认真负责，不水群。', category: '项目组队', max: 2 },
    { title: '考研408离散数学对练', desc: '备战考研，希望找个也考408的队友一起刷离散数学部分。主要做王道+天勤的题目，每周对一次答案讨论错题。', category: '考研搭子', max: 2 },
    { title: '离散+线代联报互卷', desc: '同时修离散数学和线性代数的同学有没有？感觉两门课有些概念可以对照着学（矩阵和关系矩阵），找搭子一起卷！', category: '技能交换', max: 3 },
    { title: '离散数学笔记交换', desc: '我记了比较详细的前三章笔记（命题逻辑、集合论、关系），求换图论和代数系统部分的笔记。手写电子版都可以。', category: '其他', max: 3 },
    { title: '离散数学课后讨论群', desc: '建了一个离散数学课后学习群，大家可以随时在群里提问讨论。已有5人，再招3个。群里氛围很好不会的问题基本半小时内有人回。', category: '项目组队', max: 3 },
  ];

  const squarePostIds = [];
  for (const sp of squarePosts) {
    const author = pick(userList, 1)[0];
    try {
      const r = await fetch(BASE + '/api/courses/' + COURSE_ID + '/square-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk(author.id, author.username) },
        body: JSON.stringify({ title: sp.title, category: sp.category, description: sp.desc, max_people: sp.max }),
      });
      const d = await r.json();
      if (r.ok) { squarePostIds.push({ id: d.id || d.postId, creatorId: author.id, max: sp.max }); process.stdout.write('.'); }
      else console.log('  Square fail:', d.error);
    } catch(e) { console.log('  Error:', e.message); }
  }
  console.log(' Square posts:', squarePostIds.length);

  // Square interests
  let interestCount = 0;
  for (const sp of squarePostIds) {
    const num = 2 + Math.floor(Math.random() * 3);
    const applicants = pick(userList, num).filter(u => u.id !== sp.creatorId);
    let confirmed = 0;
    for (const a of applicants) {
      try {
        const r = await fetch(BASE + '/api/courses/' + COURSE_ID + '/square-posts/' + sp.id + '/interest', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + tk(a.id, a.username) },
        });
        const d = await r.json();
        const interestId = d.id || d.interestId;
        if (interestId) {
          interestCount++;
          if (confirmed < sp.max && Math.random() < 0.6) {
            const creator = userList.find(u => u.id === sp.creatorId);
            await fetch(BASE + '/api/courses/' + COURSE_ID + '/square-interests/' + interestId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk(sp.creatorId, creator?.username || '') },
              body: JSON.stringify({ action: 'accept' }),
            });
            confirmed++;
          }
        }
      } catch(e) {}
    }
  }
  console.log(' Square interests:', interestCount);

  // Square comments
  let sCommentCount = 0;
  const sqComments = ['算我一个！', '已申请，求通过～', '请问零基础可以吗', '好帖帮顶', '这方面我也需要', '这个好！', '有兴趣，已私聊', '请问一周要花多少时间'];
  for (const sp of squarePostIds) {
    const num = 3 + Math.floor(Math.random() * 3);
    const commenters = pick(userList, num);
    for (const c of commenters) {
      try {
        await fetch(BASE + '/api/courses/' + COURSE_ID + '/square-posts/' + sp.id + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk(c.id, c.username) },
          body: JSON.stringify({ content: pick(sqComments, 1)[0] }),
        });
        sCommentCount++;
      } catch(e) {}
    }
  }
  console.log(' Square comments:', sCommentCount);

  // ═══════════════════ 3. Materials ═══════════════════
  console.log('\n--- 学习资料 ---');
  const materials = [
    { title: '离散数学 命题逻辑 完整课件', desc: '李言辉老师第1-2章课件，含真值表、范式、推理规则', category: '课件', chapter: '第1-2章' },
    { title: '离散数学 图论 课件', desc: '图的基本概念、最短路径、欧拉图与哈密顿图、树', category: '课件', chapter: '第5-6章' },
    { title: '离散数学 课堂笔记合集（手写版）', desc: '全学期课堂笔记扫描版，重点用荧光笔标注', category: '笔记', chapter: '全册' },
    { title: '离散数学 关系与函数 笔记', desc: '等价关系、偏序关系、函数性质详细笔记含例题', category: '笔记', chapter: '第3-4章' },
    { title: '离散数学 2024 期末真题（回忆版）', desc: '含选择、填空、证明和综合题，部分有参考答案', category: '真题', chapter: '综合' },
    { title: '离散数学 期末复习提纲', desc: '按章节整理的重点考点和常见题型，适合考前快速过一遍', category: '其他', chapter: '综合' },
  ];

  const dummyPDF = Buffer.from('%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF', 'utf-8');

  const matIds = [];
  for (const mat of materials) {
    const uploader = pick(userList, 1)[0];
    const filename = mat.title.replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';
    const file = new File([dummyPDF], filename, { type: 'application/pdf' });
    const fd = new FormData();
    fd.append('file', file, filename);
    fd.append('title', mat.title);
    fd.append('description', mat.desc);
    fd.append('category', mat.category);
    fd.append('chapter', mat.chapter);

    try {
      const r = await fetch(BASE + '/api/materials/courses/' + COURSE_ID, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + tk(uploader.id, uploader.username) },
        body: fd,
      });
      if (r.ok) { const d = await r.json(); matIds.push(d.id || d.materialId); process.stdout.write('.'); }
      else { const d = await r.json(); console.log('  Mat fail:', d.error); }
    } catch(e) { console.log('  Error:', e.message); }
  }
  console.log(' Materials:', matIds.length);

  // Material ratings
  let ratingCount = 0;
  for (const mid of matIds) {
    const raters = pick(userList, 2 + Math.floor(Math.random() * 3));
    for (const rater of raters) {
      try {
        await fetch(BASE + '/api/materials/' + mid + '/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk(rater.id, rater.username) },
          body: JSON.stringify({ rating: 3 + Math.floor(Math.random() * 3) }),
        });
        ratingCount++;
      } catch(e) {}
    }
  }
  console.log(' Ratings:', ratingCount);

  console.log('\n✅ 离散数学课程数据填充完成！');
}

main().catch(e => { console.error(e); process.exit(1); });
