import { CATEGORY_LABELS } from './constants';
import { sitePath } from './site-path';
import type { WordEntry } from './types';
import { getAdverbThemeInfo } from './adverbs-data';
import { getCaseThemeInfo } from './cases-data';

export function breadcrumbsForWord(entry: WordEntry) {
  const crumbs: { label: string; href?: string }[] = [
    { label: 'Главная', href: sitePath('index.html') },
  ];

  if (entry.category) {
    crumbs.push({
      label: CATEGORY_LABELS[entry.category] ?? entry.category,
      href: sitePath(`words/${entry.category}/index.html`),
    });
  }

  if (entry.category === 'adverbs') {
    const theme = getAdverbThemeInfo(entry.slug);
    if (theme) {
      crumbs.push({
        label: theme.title,
        href: sitePath(`words/adverbs/${theme.subDir}/index.html`),
      });
    }
  }

  if (entry.category === 'cases') {
    const theme = getCaseThemeInfo(entry.slug);
    if (theme) {
      crumbs.push({
        label: theme.title,
        href: sitePath(`words/cases/${theme.subDir}/index.html`),
      });
    }
  }

  crumbs.push({ label: entry.translation || entry.title });
  return crumbs;
}

export function breadcrumbsForIndex(
  relativePath: string,
  title: string,
): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: 'Главная', href: sitePath('index.html') },
  ];

  if (relativePath.toLowerCase() === 'readme.md') {
    crumbs.push({ label: title });
    return crumbs;
  }

  const category = relativePath.split('/')[0];
  if (category === 'lessons') {
    if (relativePath.toLowerCase() !== 'lessons/readme.md') {
      crumbs.push({ label: 'Уроки', href: sitePath('words/lessons/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'blocks') {
    if (relativePath.toLowerCase() !== 'blocks/readme.md') {
      crumbs.push({ label: 'Блоки', href: sitePath('words/blocks/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'essays') {
    if (relativePath.toLowerCase() !== 'essays/readme.md') {
      crumbs.push({ label: 'Сочинения', href: sitePath('words/essays/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'songs') {
    if (relativePath.toLowerCase() !== 'songs/readme.md') {
      crumbs.push({ label: 'Песни', href: sitePath('words/songs/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'topics') {
    crumbs.push({ label: 'Темы', href: sitePath('words/topics/index.html') });
    if (relativePath.toLowerCase() !== 'topics/readme.md') crumbs.push({ label: title });
    else crumbs[crumbs.length - 1] = { label: title };
    return crumbs;
  }

  if (category === 'levels') {
    crumbs.push({ label: 'Уровни', href: sitePath('words/levels/index.html') });
    if (relativePath.toLowerCase() !== 'levels/readme.md') crumbs.push({ label: title });
    else crumbs[crumbs.length - 1] = { label: title };
    return crumbs;
  }

  if (category === 'favorites') {
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'adverbs') {
    if (relativePath.toLowerCase() !== 'adverbs/readme.md') {
      crumbs.push({ label: 'Наречия', href: sitePath('words/adverbs/index.html') });
    } else {
      crumbs.push({ label: 'Словарь', href: sitePath('words/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'cases') {
    if (relativePath.toLowerCase() !== 'cases/readme.md') {
      crumbs.push({ label: 'Падежи', href: sitePath('words/cases/index.html') });
    } else {
      crumbs.push({ label: 'Словарь', href: sitePath('words/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category && CATEGORY_LABELS[category]) {
    crumbs.push({ label: 'Словарь', href: sitePath('words/index.html') });
  }
  crumbs.push({ label: title });
  return crumbs;
}
