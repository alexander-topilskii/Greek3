import path from 'path';
import {
  buildCatalogOrder,
  catalogWordExtras,
  CATEGORY_ORDER,
  CATALOG_BLOCK_SIZE,
  collectLessonWords,
  interleaveByCategory,
} from './catalog-order';
import { buildLevelAggregates, buildTopicAggregates } from './meta';
import { parseIndexFile } from './parse-index';
import type { CatalogWord, IndexLink, IndexPage, VerbCatalog, WordEntry } from './types';
import { CATEGORY_LABELS } from './constants';
import { buildCatalogWord, renderIndex, renderTopicLevelHub, sitePath, syntheticIndexFromCatalog } from './render';
import { breadcrumbsForIndex } from './breadcrumbs';
import { writeHtml, writeJson } from './fs';
import {
  addSlugToPagesMap,
  buildPageSectionId,
  buildSubsectionId,
  pageIdFromIndexSource,
} from './favorites-id';

export function wordFromIndexLink(
  link: IndexLink,
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
): WordEntry | null {
  const key = link.resolvedHref.replace(/\.html$/i, '');
  const bySlug = wordsBySlug.get(key);
  if (bySlug) return bySlug;
  const base = path.basename(link.resolvedHref);
  return wordsByHref.get(base) ?? null;
}

export function buildPagesMap(
  indexPages: IndexPage[],
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
  extraPageCatalogs: { pageId: string; words: CatalogWord[]; subsectionTitles?: string[] }[] = [],
): Record<string, string[]> {
  const pages: Record<string, string[]> = {};

  function ingestIndexPage(index: IndexPage) {
    const pageId = pageIdFromIndexSource(index.sourcePath);
    if (!pageId) return;

    const pageKey = buildPageSectionId(pageId);
    const displaySections =
      index.sections.length > 0
        ? index.sections
        : [{ title: '', links: index.links }];

    for (const section of displaySections) {
      const subsectionKey = section.title
        ? buildSubsectionId(pageId, section.title)
        : null;

      for (const link of section.links) {
        const word = wordFromIndexLink(link, wordsBySlug, wordsByHref);
        if (!word) continue;
        addSlugToPagesMap(pages, pageKey, word.slug);
        if (subsectionKey) addSlugToPagesMap(pages, subsectionKey, word.slug);
      }
    }
  }

  for (const index of indexPages) {
    ingestIndexPage(index);
  }

  for (const extra of extraPageCatalogs) {
    const pageKey = buildPageSectionId(extra.pageId);
    for (const word of extra.words) {
      addSlugToPagesMap(pages, pageKey, word.slug);
    }
    if (extra.subsectionTitles?.length === 1 && extra.words.length) {
      const subsectionKey = buildSubsectionId(extra.pageId, extra.subsectionTitles[0]);
      for (const word of extra.words) {
        addSlugToPagesMap(pages, subsectionKey, word.slug);
      }
    }
  }

  return pages;
}

export function buildGlobalCatalog(
  indexPages: IndexPage[],
  words: WordEntry[],
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
  pages?: Record<string, string[]>,
): VerbCatalog {
  const seen = new Set<string>();
  const ordered: CatalogWord[] = [];

  function addCatalogItem(item: ReturnType<typeof buildCatalogOrder>[number]) {
    if (seen.has(item.word.slug)) return;
    seen.add(item.word.slug);
    ordered.push({
      ...buildCatalogWord(item.word, item.href, item.label),
      ...catalogWordExtras(item),
    });
  }

  const lessonHub = indexPages.find((p) => p.sourcePath.toLowerCase() === 'lessons/readme.md');
  const lessonWords = lessonHub
    ? collectLessonWords(indexPages, lessonHub, (link) =>
        wordFromIndexLink(link, wordsBySlug, wordsByHref),
      )
    : [];
  const lessonSlugs = new Set(lessonWords.map((lw) => lw.word.slug));

  const byCategory = new Map<string, WordEntry[]>();
  for (const word of words) {
    if (lessonSlugs.has(word.slug)) continue;
    const cat = word.category ?? 'other';
    const list = byCategory.get(cat) ?? [];
    list.push(word);
    byCategory.set(cat, list);
  }

  const interleaved = interleaveByCategory(byCategory, CATEGORY_ORDER);

  const interleavedSlugs = new Set(interleaved.map((w) => w.slug));
  const remaining: WordEntry[] = [];
  for (const word of words) {
    if (lessonSlugs.has(word.slug) || interleavedSlugs.has(word.slug)) continue;
    remaining.push(word);
  }
  remaining.sort((a, b) =>
    (a.translation || a.title).localeCompare(b.translation || b.title, 'ru'),
  );

  const hrefForWord = (word: WordEntry) => {
    const fileName = `${path.basename(word.sourcePath).replace(/\.md$/i, '')}.html`;
    return `${word.category}/${fileName}`;
  };
  const labelForWord = (word: WordEntry) => word.translation || word.title;

  const catalogItems = buildCatalogOrder(
    lessonWords,
    [...interleaved, ...remaining],
    hrefForWord,
    labelForWord,
  );

  for (const item of catalogItems) {
    addCatalogItem(item);
  }

  const pagesMap = pages ?? buildPagesMap(indexPages, wordsBySlug, wordsByHref);

  return {
    deckId: 'global',
    words: ordered,
    blockSize: CATALOG_BLOCK_SIZE,
    categoryLabels: CATEGORY_LABELS,
    pages: pagesMap,
  };
}

export function buildCatalogForIndex(
  index: IndexPage,
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
  pageDir: string,
): VerbCatalog {
  const deckId = pageDir.replace(/^words\/?/, '').replace(/\//g, '-') || 'default';
  const pageId = pageDir.replace(/^words\/?/, '').replace(/\/$/, '') || undefined;
  return {
    deckId,
    pageId,
    words: index.links
      .map((link) => {
        const word = wordFromIndexLink(link, wordsBySlug, wordsByHref);
        if (!word) return null;
        return buildCatalogWord(word, link.resolvedHref, link.label);
      })
      .filter(Boolean) as CatalogWord[],
  };
}

export function writeCatalog(pageDir: string, catalog: VerbCatalog): void {
  if (catalog.words.length === 0) return;
  writeJson(`${pageDir}/catalog.json`, catalog);
}

export function renderTopicLevelPages(allWords: CatalogWord[]): void {
  const topicAggregates = buildTopicAggregates(allWords);
  const levelAggregates = buildLevelAggregates(allWords);

  writeHtml(
    'words/topics/index.html',
    renderTopicLevelHub(
      'Темы',
      topicAggregates.map((t) => ({
        title: t.title,
        href: `words/topics/${t.slug}/index.html`,
        count: t.words.length,
      })),
      breadcrumbsForIndex('topics/readme.md', 'Темы'),
    ),
  );

  for (const topic of topicAggregates) {
    const catalog: VerbCatalog = { deckId: `topic-${topic.slug}`, words: topic.words };
    const pageDir = `words/topics/${topic.slug}`;
    writeCatalog(pageDir, catalog);
    const index = syntheticIndexFromCatalog(
      topic.title,
      `Слова и фразы по теме «${topic.title}».`,
      catalog,
      `topics/${topic.slug}/readme.md`,
    );
    writeHtml(
      `${pageDir}/index.html`,
      renderIndex(
        index,
        pageDir,
        [
          { label: 'Главная', href: sitePath('index.html') },
          { label: 'Темы', href: sitePath('words/topics/index.html') },
          { label: topic.title },
        ],
        catalog,
      ),
    );
    console.log(`  🏷  words/topics/${topic.slug}/index.html (${topic.words.length})`);
  }

  writeHtml(
    'words/levels/index.html',
    renderTopicLevelHub(
      'Уровни CEFR',
      levelAggregates.map((l) => ({
        title: l.level,
        href: `words/levels/${l.level.toLowerCase()}/index.html`,
        count: l.words.length,
        description: `${l.words.length} записей · уровень ${l.level}`,
      })),
      breadcrumbsForIndex('levels/readme.md', 'Уровни'),
    ),
  );

  for (const levelAgg of levelAggregates) {
    const slug = levelAgg.level.toLowerCase();
    const catalog: VerbCatalog = { deckId: `level-${slug}`, words: levelAgg.words };
    const pageDir = `words/levels/${slug}`;
    writeCatalog(pageDir, catalog);
    const index = syntheticIndexFromCatalog(
      levelAgg.level,
      `Лексика уровня ${levelAgg.level}.`,
      catalog,
      `levels/${slug}/readme.md`,
    );
    writeHtml(
      `${pageDir}/index.html`,
      renderIndex(
        index,
        pageDir,
        [
          { label: 'Главная', href: sitePath('index.html') },
          { label: 'Уровни', href: sitePath('words/levels/index.html') },
          { label: levelAgg.level },
        ],
        catalog,
      ),
    );
    console.log(`  📊 words/levels/${slug}/index.html (${levelAgg.words.length})`);
  }
}
