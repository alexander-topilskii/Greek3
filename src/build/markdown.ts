import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return '';
  return marked.parse(trimmed) as string;
}
