import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/pages/auth.js', import.meta.url), 'utf8');

test('search page exposes a square posts tab', () => {
  assert.match(source, /data-tab="squarePosts">广场/);
  assert.match(source, /搜索课程、资料、帖子、广场\.\.\./);
  assert.doesNotMatch(source, /广场帖子/);
});

test('search results render square posts and link to the existing detail page', () => {
  assert.match(source, /const \{ courses = \[\], materials = \[\], posts = \[\], squarePosts = \[\] \} = data;/);
  assert.match(source, /if \(squarePosts\.length > 0\)/);
  assert.match(source, /navigateTo\('square-post', \$\{p\.id\}\)/);
  assert.match(source, /remainingDays/);
});
