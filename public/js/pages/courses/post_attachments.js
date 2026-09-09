import { escHtml, formatFileSize } from '../../components/ui.js';

export function renderPostAttachments(attachments = []) {
  if (!attachments.length) return '';
  const images = attachments.filter(attachment => attachment.file_type === 'image');
  const files = attachments.filter(attachment => attachment.file_type !== 'image');
  return `
    ${images.length ? `
      <div class="post-image-grid count-${images.length}">
        ${images.map(attachment => `
          <a href="${attachment.view_url}" target="_blank" rel="noopener" class="post-image-link">
            <img src="${attachment.view_url}" alt="${escHtml(attachment.file_name)}" loading="lazy">
          </a>
        `).join('')}
      </div>
    ` : ''}
    ${files.length ? `
      <div class="post-attachment-list">
        ${files.map(attachment => `
          <a class="post-attachment-row" href="${attachment.download_url}">
            <span class="mi">attach_file</span>
            <span>${escHtml(attachment.file_name)}</span>
            <span class="text-secondary">${formatFileSize(attachment.file_size)}</span>
          </a>
        `).join('')}
      </div>
    ` : ''}
  `;
}
