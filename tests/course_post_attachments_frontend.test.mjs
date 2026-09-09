import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publishSource = await readFile(new URL('../public/js/pages/courses/publish.js', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('../public/js/pages/courses/detail.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../public/css/style.css', import.meta.url), 'utf8');

test('publish page selects and submits multiple attachments', () => {
  assert.match(publishSource, /id="publish-file-input"[^>]*multiple/);
  assert.match(publishSource, /formData\.append\('files', file\)/);
  assert.match(publishSource, /MAX_FILE_COUNT = 9/);
});

test('course detail page renders post attachments', () => {
  assert.match(detailSource, /renderPostAttachments/);
  assert.match(styleSource, /\.post-image-grid/);
  assert.match(styleSource, /\.post-attachment-row/);
});
