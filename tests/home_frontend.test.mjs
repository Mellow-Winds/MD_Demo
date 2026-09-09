import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');
const routerSource = await readFile(new URL('../public/js/core/router.js', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../public/js/pages/home.js', import.meta.url), 'utf8').catch(() => '');
const styleSource = await readFile(new URL('../public/css/style.css', import.meta.url), 'utf8');

test('home page is the default app entry and sidebar destination', () => {
  assert.match(indexSource, /data-page="home"/);
  assert.match(mainSource, /import '\.\/pages\/home\.js'/);
  assert.match(mainSource, /initRouter\(\(\) => navigateTo\('home'\)\)/);
  assert.match(routerSource, /page: 'home'/);
  assert.match(homeSource, /registerPage\('home'/);
});

test('home page renders campus hero, personal stats, hot courses, and fun plugins', () => {
  assert.match(homeSource, /选一门课/);
  assert.match(homeSource, /也遇见一群人/);
  assert.match(homeSource, /学习邀约<br>和校园里的小小连接/);
  assert.match(homeSource, /今日课程/);
  assert.match(homeSource, /连续签到/);
  assert.match(homeSource, /通知个数/);
  assert.match(homeSource, /热门课程/);
  assert.match(homeSource, /趣味插件/);
  assert.match(homeSource, /番茄时钟/);
  assert.match(homeSource, /今日运气值/);
  assert.match(homeSource, /替我抉择/);
  assert.match(homeSource, /薛定谔的待办/);
  assert.match(homeSource, /答案之书/);
  assert.match(homeSource, /发布学习邀约/);
  assert.match(homeSource, /avatarDataUri/);
  assert.match(homeSource, /api\/courses\/all/);
  assert.match(styleSource, /\.home-hero/);
  assert.match(styleSource, /\.home-plugin-grid/);
  assert.match(styleSource, /width: 196px/);
});
