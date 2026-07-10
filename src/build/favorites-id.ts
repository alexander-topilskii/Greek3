/** Идентификаторы избранного — должны совпадать с site/js/favorites.js */

export function slugifyFavorite(text: string): string {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё\-_/]/gi, '')
    .slice(0, 80);
}

export function pageIdFromIndexSource(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/');
  const dir = normalized.includes('/')
    ? normalized.slice(0, normalized.lastIndexOf('/'))
    : '';
  return dir;
}

export function buildPageSectionId(pageId: string): string {
  return `page:${pageId.replace(/^words\/?/i, '').replace(/\/index\.html$/i, '').replace(/\/$/, '')}`;
}

export function buildSubsectionId(pageId: string, title: string): string {
  const pid = pageId.replace(/^words\/?/i, '').replace(/\/$/, '');
  const slug = slugifyFavorite(title) || 'group';
  return `subsection:${pid}:${slug}`;
}

export function addSlugToPagesMap(
  pages: Record<string, string[]>,
  key: string,
  slug: string,
): void {
  if (!key || !slug) return;
  const list = pages[key] ?? [];
  if (!list.includes(slug)) list.push(slug);
  pages[key] = list;
}
