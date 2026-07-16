import path from 'path';
import { normalizeSearchText } from './normalize-search';
import type { WordEntry } from './types';

export interface GreekFormTarget {
  slug: string;
  label: string;
  matchKind: 'primary' | 'base' | 'form';
}

export function buildGreekFormLookup(words: WordEntry[]): Map<string, GreekFormTarget[]> {
  const map = new Map<string, GreekFormTarget[]>();

  for (const word of words) {
    const label = word.translation || word.title;
    const target = { slug: word.slug, label };

    const add = (greek: string, matchKind: GreekFormTarget['matchKind']) => {
      const trimmed = greek.trim();
      if (!trimmed) return;
      const key = normalizeSearchText(trimmed);
      const entry: GreekFormTarget = { ...target, matchKind };
      const list = map.get(key) ?? [];
      if (!list.some((item) => item.slug === word.slug)) {
        list.push(entry);
        map.set(key, list);
      }
    };

    if (word.primaryGreek) add(word.primaryGreek, 'primary');
    for (const form of word.baseForms) add(form, 'base');
    for (const form of word.forms) add(form.greek, 'form');
  }

  return map;
}

const MATCH_PRIORITY: Record<GreekFormTarget['matchKind'], number> = {
  primary: 0,
  base: 1,
  form: 2,
};

export function resolveGreekFormLink(
  lookup: Map<string, GreekFormTarget[]>,
  greek: string,
  currentSlug: string,
): GreekFormTarget | null {
  const key = normalizeSearchText(greek.trim());
  if (!key) return null;

  const matches = lookup.get(key)?.filter((item) => item.slug !== currentSlug) ?? [];
  if (!matches.length) return null;

  matches.sort(
    (a, b) =>
      MATCH_PRIORITY[a.matchKind] - MATCH_PRIORITY[b.matchKind] ||
      a.slug.localeCompare(b.slug, 'ru'),
  );

  return matches[0];
}
