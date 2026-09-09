/**
 * pages/courses/publish.js — 统一发布表单
 * registerPage: publish
 *
 * 挂载路由 /course/:id/posts
 * 返回按钮统一回到 course-detail
 * 强制固定分类下拉 · 文件上传20MB限制
 * 资料分享或有附件时 → 同步开关强制开启且置灰
 */

import { apiGet, apiPost, getToken, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, bindRipples } from '../../core/router.js';
import { showToast, createMdSelect, escHtml, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';

/* =============================================
   分类配置
   ============================================= */

const POST_CATEGORIES = [
  { text: '讨论', value: '讨论' },
  { text: '资料分享', value: '资料分享' },
  { text: '水贴', value: '水贴' },
  { text: '求助', value: '求助' },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILE_COUNT = 9;

/* =============================================
   Page: 统一发布表单
   ============================================= */

registerPage('publish', async (container, courseId) => {
  if (!isLoggedIn()) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `<div class="card"><p class="text-secondary">加载中...</p></div>`;

  let course;
  try {
    course = await apiGet(`/api/courses/${courseId}`);
    if (course.error) {
      container.innerHTML = `<div class="card"><p class="text-secondary">${course.error}</p></div>`;
      return;
    }
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
    return;
  }

  // 清洗课程名用于面包屑显示
  const cleanTitle = course.title.replace(/\d{1,3}\s*班\s*$/, '').replace(/[\s ]*\d{1,3}\s*$/, '').replace(/\d{1,3}$/, '').trim();

  container.innerHTML = `
    <div class="create-post-page">
      <div class="create-post-header">
        <button class="btn btn-icon" onclick="navigateTo('course-detail', ${courseId})" title="返回">
          <span class="mi">arrow_back</span>
        </button>
        <div class="create-post-breadcrumb">
          <span class="text-secondary">${escHtml(cleanTitle)}</span>
          <span class="mi" style="font-size:18px;color:var(--md-outline)">chevron_right</span>
          <span style="font-weight:600">发帖</span>
        </div>
      </div>

      <div class="md-input-group" style="--md-field-bg: var(--md-surface)">
        <input class="md-input" type="text" id="publish-title" placeholder=" " required>
        <label class="md-label">标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>标题</span></legend></fieldset>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:var(--text-sm);font-weight:600;color:var(--md-on-surface);display:block;margin-bottom:8px">分类</label>
        ${createMdSelect({
          id: 'publish-category',
          label: '选择分类',
          options: POST_CATEGORIES,
          selected: '讨论',
        })}
      </div>

      <div class="rte-toolbar" role="toolbar" aria-label="文本格式化">
        <button type="button" class="rte-btn" data-cmd="bold" title="加粗 (Ctrl+B)">
          <span class="mi">format_bold</span>
        </button>
        <button type="button" class="rte-btn" data-cmd="italic" title="斜体 (Ctrl+I)">
          <span class="mi">format_italic</span>
        </button>
        <button type="button" class="rte-btn" data-cmd="underline" title="下划线 (Ctrl+U)">
          <span class="mi">format_underlined</span>
        </button>
      </div>

      <div class="rte-wrapper">
        <div class="rte-editor" contenteditable="true" id="publish-content" role="textbox" aria-multiline="true" aria-label="帖子内容"></div>
        <label class="rte-label">内容</label>
        <fieldset class="rte-border" aria-hidden="true"><legend><span>内容</span></legend></fieldset>
      </div>

      <div class="publish-attach-section">
        <label style="font-size:var(--text-sm);font-weight:600;color:var(--md-on-surface);display:block;margin-bottom:8px">
          <span class="mi" style="font-size:16px;vertical-align:-3px">attach_file</span> 附件（可选，最大 20MB）
        </label>
        <div id="publish-drop-zone" class="upload-drop-zone">
          <span class="mi" style="font-size:36px;color:var(--md-outline-variant)">cloud_upload</span>
          <p style="margin-top:8px;color:var(--md-on-surface-variant);font-size:14px">点击选择文件或拖拽到此处</p>
          <input type="file" id="publish-file-input" style="display:none" multiple onchange="onPublishFileSelected(this)">
          <p id="publish-file-name" style="display:none;font-size:14px;font-weight:500;color:var(--md-primary);margin-top:8px"></p>
        </div>
      </div>

      <div class="form-error" id="publish-error" style="display:none"></div>

      <button class="btn btn-primary" id="publish-submit-btn" style="width:100%;justify-content:center">
        <span class="mi">send</span> 发布
      </button>
    </div>
  `;

  // ---- 绑定事件 ----

  const editor = container.querySelector('#publish-content');
  const toolbar = container.querySelector('.rte-toolbar');

  toolbar.addEventListener('mousedown', (e) => e.preventDefault());

  editor.addEventListener('focus', () => {
    toolbar.style.borderColor = 'var(--md-primary)';
    toolbar.style.transition = 'border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)';
  });
  editor.addEventListener('blur', () => {
    toolbar.style.borderColor = '';
  });

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.rte-btn');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    document.execCommand(cmd, false, null);
    editor.focus();
    syncToolbarState();
  });

  function syncToolbarState() {
    toolbar.querySelectorAll('.rte-btn').forEach(btn => {
      const cmd = btn.dataset.cmd;
      btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }

  editor.addEventListener('keyup', syncToolbarState);
  editor.addEventListener('mouseup', syncToolbarState);

  const editorWrapper = container.querySelector('.rte-wrapper');
  function syncEditorContent() {
    editorWrapper.classList.toggle('has-content', editor.textContent.trim().length > 0);
  }
  editor.addEventListener('input', syncEditorContent);
  editor.addEventListener('blur', syncEditorContent);

  // ---- 附件上传 ----

  const dropZone = document.getElementById('publish-drop-zone');
  const fileInput = document.getElementById('publish-file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > MAX_FILE_COUNT) {
        showToast('每个帖子最多上传 9 个附件');
        return;
      }
      if (files.some(file => file.size > MAX_FILE_SIZE)) {
        showToast('文件大小超过 20MB 限制');
        return;
      }
      fileInput.files = e.dataTransfer.files;
      onPublishFileSelected(fileInput);
    }
  });

  // ---- 提交 ----

  container.querySelector('#publish-submit-btn').addEventListener('click', async () => {
    const title = container.querySelector('#publish-title').value.trim();
    const content = editor.innerHTML.trim();
    const errEl = container.querySelector('#publish-error');
    errEl.style.display = 'none';

    if (!title) {
      errEl.textContent = '请输入标题';
      errEl.style.display = 'block';
      return;
    }
    const textContent = editor.textContent.trim();
    if (!textContent) {
      errEl.textContent = '请输入内容';
      errEl.style.display = 'block';
      return;
    }

    const category = document.getElementById('publish-category')?.value || '讨论';
    const hasFile = fileInput.files.length > 0;

    const btn = container.querySelector('#publish-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mi">hourglass_empty</span> 发布中...';

    try {
      let result;

      if (hasFile) {
        // 有附件 → FormData 提交
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('category', category);
        for (const file of fileInput.files) formData.append('files', file);

        const token = getToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/courses/${courseId}/posts`, {
          method: 'POST',
          headers,
          body: formData,
        });
        result = await res.json();
      } else {
        // 纯文本 → JSON 提交
        result = await apiPost(`/api/courses/${courseId}/posts`, {
          title,
          content,
          category,
        });
      }

      if (result.error) {
        errEl.textContent = result.error;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span class="mi">send</span> 发布';
        return;
      }

      showToast('发帖成功');
      navigateTo('course-detail', courseId);
    } catch (err) {
      errEl.textContent = '发布失败，请检查网络';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span class="mi">send</span> 发布';
    }
  });

  bindRipples(container);
  animIn(container.querySelector('.create-post-header'), { y: 16, dur: 380 });
});

/* =============================================
   文件选择回调（供内联 onchange 使用）
   ============================================= */

export function onPublishFileSelected(input) {
  const nameEl = document.getElementById('publish-file-name');
  if (input.files.length && nameEl) {
    const files = Array.from(input.files);
    if (files.length > MAX_FILE_COUNT) {
      showToast('每个帖子最多上传 9 个附件');
      input.value = '';
      nameEl.style.display = 'none';
      return;
    }
    if (files.some(file => file.size > MAX_FILE_SIZE)) {
      showToast('文件大小超过 20MB 限制');
      input.value = '';
      nameEl.style.display = 'none';
      return;
    }
    nameEl.textContent = `📎 已选择 ${files.length} 个附件：${files.map(file => file.name).join('、')}`;
    nameEl.style.display = 'block';
  }
}
