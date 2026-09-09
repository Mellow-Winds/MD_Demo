import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const notificationsSource = await readFile(new URL('../public/js/pages/notifications.js', import.meta.url), 'utf8');
const feedSource = await readFile(new URL('../public/js/pages/following_feed.js', import.meta.url), 'utf8');

test('following feed is embedded in notifications instead of using a sidebar entry', () => {
  assert.doesNotMatch(indexSource, /data-page="following-feed"/);
  assert.match(notificationsSource, /data-notification-tab="following"/);
  assert.match(notificationsSource, /renderFollowingFeed/);
  assert.match(feedSource, /export async function renderFollowingFeed/);
});

test('following feed renders all supported public activity types', () => {
  assert.match(feedSource, /material:/);
  assert.match(feedSource, /invite:/);
  assert.match(feedSource, /square_post:/);
});
