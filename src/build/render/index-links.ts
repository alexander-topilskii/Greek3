import type { CatalogWord, IndexLink, IndexPage, VerbCatalog } from '../types';
import { sitePath } from '../site-path';
import { escapeHtml } from './html';
import { renderBadges } from './badges';
import { progressBarMarkup } from './fragments';

export function normalizeSitePath(...parts: string[]): string {
  const stack: string[] = [];
  for (const part of parts.join('/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

export function indexLinkSitePath(pageOutputDir: string, link: IndexLink): string {
  if (link.resolvedHref && !/^(https?:)?\/\//.test(link.resolvedHref)) {
    return sitePath(normalizeSitePath('words', link.resolvedHref));
  }
  return sitePath(normalizeSitePath(pageOutputDir, link.href));
}

export function renderIndexLink(
  link: IndexLink,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  const catalogKey = link.resolvedHref ?? link.href;
  const word = catalog?.words.find((w) => w.href === catalogKey);
  const slug = word?.slug ?? '';
  return `
      <a href="${escapeHtml(indexLinkSitePath(pageOutputDir, link))}" class="word-link fade-in" data-word-slug="${escapeHtml(slug)}">
        <div class="word-link-main">
          <span class="word-link-label">${escapeHtml(link.label)}</span>
          <span class="word-link-arrow" aria-hidden="true">→</span>
        </div>
        ${renderBadges(word)}
        ${slug ? progressBarMarkup(slug) : ''}
      </a>`;
}

export function reverseLessonsIndex(page: IndexPage): IndexPage {
  if (page.sourcePath.toLowerCase() !== 'lessons/readme.md') return page;
  return {
    ...page,
    sections: [...page.sections]
      .reverse()
      .map((section) => ({
        ...section,
        links: [...section.links].reverse(),
      })),
    links: [...page.links].reverse(),
  };
}

export function renderGroupedLinks(
  page: IndexPage,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  const displayPage = reverseLessonsIndex(page);
  const sections =
    displayPage.sections.length > 0
      ? displayPage.sections.filter((s) => s.links.length > 0)
      : [{ title: '', links: displayPage.links }];

  if (!sections.length || !displayPage.links.length) {
    return '<p class="empty-state">Пока нет записей. Добавьте MD-файлы в этот раздел.</p>';
  }

  return sections
    .map((section) => {
      const items = section.links
        .map((link) => renderIndexLink(link, pageOutputDir, catalog))
        .join('');
      const heading = section.title
        ? `<h2 class="links-group-title">${escapeHtml(section.title)}</h2>`
        : '';
      return `
      <div class="links-group">
        ${heading}
        <div class="links-group-items">${items}</div>
      </div>`;
    })
    .join('');
}
