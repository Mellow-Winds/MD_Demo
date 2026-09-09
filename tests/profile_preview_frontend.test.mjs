import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const profileSource = await readFile(new URL('../public/js/pages/profile.js', import.meta.url), 'utf8');
const notificationsSource = await readFile(new URL('../public/js/pages/notifications.js', import.meta.url), 'utf8');

test('profile preview fetches server-filtered public data', () => {
  const previewFetcher = profileSource.match(/async function fetchPreviewData\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(previewFetcher, /profile\?preview=public/);
  assert.doesNotMatch(previewFetcher, /\.\.\.user/);
});

test('profile preview reuses the public profile renderers', () => {
  assert.match(profileSource, /renderPublicProfileCard\(data,\s*\{\s*preview:\s*true\s*\}\)/);
  assert.match(profileSource, /renderPrivacyLocked\(data,\s*\{\s*preview:\s*true\s*\}\)/);
  assert.match(profileSource, /function renderPublicProfileCard\(data,\s*options = \{\}\)/);
  assert.match(profileSource, /function renderPrivacyLocked\(data,\s*options = \{\}\)/);
});

test('profile interactions are rebound without accumulating duplicate listeners', () => {
  const binder = profileSource.match(/function bindProfileInteractions\(container\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(profileSource, /let profileInteractionController = null/);
  assert.match(binder, /profileInteractionController\.abort\(\)/);
  assert.match(binder, /new AbortController\(\)/);
  assert.match(binder, /addEventListener\('click'[\s\S]*\{ signal \}/);
});

test('contact exchange UI has the textarea dependency and renders the other user in notifications', () => {
  assert.match(profileSource, /createMdTextarea/);
  assert.match(profileSource, /createMdTextarea\(\{/);
  assert.match(notificationsSource, /const displayUser = result\.otherUser \|\| result\.fromUser \|\| \{\}/);
  assert.match(notificationsSource, /escHtml\(displayUser\.nickname/);
});
