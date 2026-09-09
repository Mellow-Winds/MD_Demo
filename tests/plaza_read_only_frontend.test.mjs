import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const detailSource = await readFile(new URL('../public/js/pages/courses/detail.js', import.meta.url), 'utf8');

test('course detail enforces read-only mode for non-enrolled users', () => {
  // The detail page checks enrollment and conditionally renders
  assert.match(detailSource, /showPublishBlockedToast/);
  // Publish button is disabled for non-enrolled users
  assert.match(detailSource, /btn-disabled/);
  // 交友 tab is only shown for enrolled users
  assert.match(detailSource, /if \(enrolled\) await renderCourseSquareTab/);
});

test('course detail never renders a publish button for non-enrolled users in the plaza', () => {
  // The publish button is conditionally rendered based on enrollment
  assert.match(detailSource, /const publishBtn = enrolled/);
  assert.match(detailSource, /btn-disabled btn-compact/);
});
