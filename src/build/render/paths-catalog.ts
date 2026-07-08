import type { CatalogWord, IndexPage, VerbCatalog, WordEntry } from '../types';
import { parseContextExamples } from '../parse-word';
import { normalizeSearchText } from '../normalize-search';
import { sitePath } from '../site-path';
import { escapeHtml, embedJson } from './html';
import { layout } from './layout';

export function wordOutputPath(slug: string): string {
  return `words/${slug}.html`;
}

export function outputDirFor(relativeHtmlPath: string): string {
  const dir = pathDirname(relativeHtmlPath);
  return dir === '.' ? '' : dir;
}

export function pathDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '.' : filePath.slice(0, idx);
}

export function depthForOutput(relativeHtmlPath: string): number {
  const dir = relativeHtmlPath.replace(/[^/]+$/, '');
  if (!dir) return 0;
  return dir.split('/').filter(Boolean).length;
}

export function buildCatalogWord(word: WordEntry, href: string, label: string): CatalogWord {
  const examples = parseContextExamples(word);
  return {
    slug: word.slug,
    translation: word.translation || word.title,
    verbType: word.verbType,
    baseForms: word.baseForms,
    href,
    label,
    formCount: word.forms.length,
    forms: word.forms,
    level: word.meta.level,
    topics: word.meta.topics,
    tags: word.meta.tags,
    recordType: word.meta.recordType,
    primaryGreek: word.primaryGreek,
    category: word.category,
    ...(examples.length > 0 ? { examples } : {}),
  };
}

export function renderTopicLevelHub(
  title: string,
  items: { title: string; href: string; count: number; description?: string }[],
  breadcrumbs: { label: string; href?: string }[],
): string {
  const cards = items
    .map(
      (item) => `
    <a href="${escapeHtml(sitePath(item.href))}" class="section-card fade-in">
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.description ?? `${item.count} записей`)}</p>
      <span class="card-arrow" aria-hidden="true">→</span>
    </a>`,
    )
    .join('');

  const content = `
    <section class="hub-page">
      <div class="page-head fade-in">
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div class="sections-grid">${cards || '<p class="empty-state">Пока нет записей с метаданными.</p>'}</div>
    </section>`;

  return layout(content, title, breadcrumbs);
}

export function syntheticIndexFromCatalog(
  title: string,
  intro: string,
  catalog: VerbCatalog,
  sourcePath: string,
): IndexPage {
  const links = catalog.words.map((w) => ({
    label: w.label,
    href: w.href,
    resolvedHref: w.href,
  }));
  return {
    title,
    intro,
    sections: [{ title: 'Все записи', links }],
    links,
    sourcePath,
  };
}