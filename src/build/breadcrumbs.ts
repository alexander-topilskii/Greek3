import { CATEGORY_LABELS } from './constants';
import { sitePath } from './site-path';
import type { WordEntry } from './types';

export function breadcrumbsForWord(entry: WordEntry) {
  return [
    { label: 'Главная', href: sitePath('index.html') },
    ...(entry.category
      ? [{
          label: CATEGORY_LABELS[entry.category] ?? entry.category,
          href: sitePath(`words/${entry.category}/index.html`),
        }]
      : []),
    { label: entry.translation || entry.title },
  ];
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

  if (category === 'essays') {
    if (relativePath.toLowerCase() !== 'essays/readme.md') {
      crumbs.push({ label: 'Сочинения', href: sitePath('words/essays/index.html') });
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

  if (category && CATEGORY_LABELS[category]) {
    crumbs.push({ label: 'Словарь', href: sitePath('words/index.html') });
  }
  crumbs.push({ label: title });
  return crumbs;
}
