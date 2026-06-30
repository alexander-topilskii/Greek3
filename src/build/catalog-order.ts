import type { CatalogWord, IndexLink, IndexPage, WordEntry } from './types';

/** Порядок категорий при чередовании (числа — по уровням, см. numberTierForSlug). */
export const CATEGORY_ORDER = [
  'verbs',
  'nouns',
  'adjectives',
  'pronouns',
  'phrases',
  'numbers',
  'particles',
] as const;

/** Размер «порции» из категории при чередовании: 3–5 слов. */
export const CATEGORY_CHUNK_CYCLE = [4, 3, 5] as const;

/** Размер блока для подсказки «переключитесь на Ру → Ελ». */
export const CATALOG_BLOCK_SIZE = 10;

const NUMBER_TIER_SLUGS = [
  'numbers/1-20',
  'numbers/20-100',
  'numbers/100-1000',
  'numbers/тысячи',
] as const;

/** index.html → readme.md для сопоставления страницы урока. */
export function indexHrefToReadmePath(resolvedHref: string): string {
  return resolvedHref.replace(/\/index\.html$/i, '/readme.md');
}

export function numberTierForSlug(slug: string): number | undefined {
  if (!slug.startsWith('numbers/')) return undefined;
  const idx = NUMBER_TIER_SLUGS.findIndex((prefix) => slug.startsWith(prefix));
  return idx >= 0 ? idx : undefined;
}

function sortWordsInCategory(cat: string, words: WordEntry[]): WordEntry[] {
  const sorted = [...words];
  if (cat === 'numbers') {
    sorted.sort((a, b) => {
      const ta = numberTierForSlug(a.slug) ?? 99;
      const tb = numberTierForSlug(b.slug) ?? 99;
      if (ta !== tb) return ta - tb;
      return (a.translation || a.title).localeCompare(b.translation || b.title, 'ru');
    });
    return sorted;
  }
  sorted.sort((a, b) =>
    (a.translation || a.title).localeCompare(b.translation || b.title, 'ru'),
  );
  return sorted;
}

/** Чередует категории, забирая по 3–5 слов из каждой за круг. */
export function interleaveByCategory(
  byCategory: Map<string, WordEntry[]>,
  categoryOrder: readonly string[] = CATEGORY_ORDER,
  chunkCycle: readonly number[] = CATEGORY_CHUNK_CYCLE,
): WordEntry[] {
  const lists = new Map(
    categoryOrder.map((cat) => [cat, sortWordsInCategory(cat, byCategory.get(cat) ?? [])]),
  );
  const cursors = new Map(categoryOrder.map((cat) => [cat, 0]));
  const result: WordEntry[] = [];
  let cycleIdx = 0;

  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    const chunk = chunkCycle[cycleIdx % chunkCycle.length];
    cycleIdx += 1;

    for (const cat of categoryOrder) {
      const list = lists.get(cat) ?? [];
      const cursor = cursors.get(cat) ?? 0;
      const end = Math.min(cursor + chunk, list.length);
      for (let i = cursor; i < end; i++) {
        result.push(list[i]);
      }
      cursors.set(cat, end);
      if (end < list.length) hasMore = true;
    }
  }

  return result;
}

export interface LessonWordRef {
  word: WordEntry;
  href: string;
  label: string;
  lesson: number;
}

/** Слова из уроков в порядке уроков 1 → N (внутри урока — как в readme). */
export function collectLessonWords(
  indexPages: IndexPage[],
  lessonHub: IndexPage,
  wordFromIndexLink: (link: IndexLink) => WordEntry | null,
): LessonWordRef[] {
  const result: LessonWordRef[] = [];
  const seen = new Set<string>();

  const lessonPageByPath = new Map(
    indexPages
      .filter((p) => /^lessons\/\d+\/readme\.md$/i.test(p.sourcePath))
      .map((p) => [p.sourcePath.replace(/\\/g, '/'), p]),
  );

  for (let li = 0; li < lessonHub.links.length; li++) {
    const lessonLink = lessonHub.links[li];
    const lessonPath = indexHrefToReadmePath(lessonLink.resolvedHref);
    const lessonPage = lessonPageByPath.get(lessonPath);
    if (!lessonPage) continue;

    const lessonNum = li + 1;
    for (const link of lessonPage.links) {
      const word = wordFromIndexLink(link);
      if (!word || seen.has(word.slug)) continue;
      seen.add(word.slug);
      result.push({
        word,
        href: link.resolvedHref,
        label: link.label,
        lesson: lessonNum,
      });
    }
  }

  return result;
}

export interface CatalogBuildItem {
  word: WordEntry;
  href: string;
  label: string;
  lesson?: number;
  numberTier?: number;
  blockIndex: number;
}

export function assignBlockIndices(items: Omit<CatalogBuildItem, 'blockIndex'>[]): CatalogBuildItem[] {
  return items.map((item, index) => ({
    ...item,
    blockIndex: Math.floor(index / CATALOG_BLOCK_SIZE),
  }));
}

export function buildCatalogOrder(
  lessonWords: LessonWordRef[],
  remainingInterleaved: WordEntry[],
  hrefForWord: (word: WordEntry) => string,
  labelForWord: (word: WordEntry) => string,
): CatalogBuildItem[] {
  const items: Omit<CatalogBuildItem, 'blockIndex'>[] = [];

  for (const lw of lessonWords) {
    items.push({
      word: lw.word,
      href: lw.href,
      label: lw.label,
      lesson: lw.lesson,
      numberTier: numberTierForSlug(lw.word.slug),
    });
  }

  for (const word of remainingInterleaved) {
    items.push({
      word,
      href: hrefForWord(word),
      label: labelForWord(word),
      numberTier: numberTierForSlug(word.slug),
    });
  }

  return assignBlockIndices(items);
}

export function catalogWordExtras(item: CatalogBuildItem): Pick<CatalogWord, 'lesson' | 'blockIndex' | 'numberTier'> {
  const extras: Pick<CatalogWord, 'lesson' | 'blockIndex' | 'numberTier'> = {
    blockIndex: item.blockIndex,
  };
  if (item.lesson != null) extras.lesson = item.lesson;
  if (item.numberTier != null) extras.numberTier = item.numberTier;
  return extras;
}
