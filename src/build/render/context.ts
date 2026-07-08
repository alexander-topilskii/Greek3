import { renderMarkdown } from '../markdown';
import { escapeHtml } from './html';

export function renderContextSection(lines: string[]): string {
  const items: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const content = trimmed.replace(/^-\s*/, '');
    const parts = content.split(/\s+[—–-]\s+/);
    if (parts.length >= 2) {
      const greek = parts[0].replace(/\*\*/g, '').trim();
      const ru = parts.slice(1).join(' — ').trim();
      items.push(`
        <div class="context-bubble">
          <p class="context-bubble-greek greek">${renderMarkdown(greek)}</p>
          <p class="context-bubble-ru">${escapeHtml(ru)}</p>
        </div>`);
    } else {
      items.push(`<div class="context-bubble"><div class="context-bubble-ru">${renderMarkdown(content)}</div></div>`);
    }
  }
  if (!items.length) return renderMarkdown(lines.join('\n'));
  return `<div class="context-bubbles">${items.join('')}</div>`;
}