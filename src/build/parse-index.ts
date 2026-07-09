import fs from 'fs';
import path from 'path';
import type { IndexLink, IndexPage, IndexSection } from './types';

function mdLinkToHtml(href: string): string {
  if (href.toLowerCase().endsWith('readme.md')) {
    return href.replace(/readme\.md$/i, 'index.html');
  }
  if (href.endsWith('.md')) {
    return href.replace(/\.md$/i, '.html');
  }
  return href;
}

export function resolveIndexLinkHref(href: string, indexRelativePath: string): string {
  const htmlHref = mdLinkToHtml(href.trim());
  if (/^(https?:)?\/\//.test(htmlHref) || htmlHref.startsWith('/')) {
    return htmlHref;
  }
  const indexDir = path.dirname(indexRelativePath.replace(/\\/g, '/'));
  return path.normalize(path.join(indexDir, htmlHref)).replace(/\\/g, '/');
}

/** Одна markdown-ссылка на строке; поддерживает скобки в пути (`файл (пояснение).md`). */
export function parseMarkdownLinkLine(line: string): { label: string; href: string } | null {
  const trimmed = line.trim();
  const labelStart = trimmed.match(/^\[([^\]]+)\]\(/);
  if (!labelStart) return null;

  const label = labelStart[1].trim();
  const rest = trimmed.slice(labelStart[0].length);

  if (rest.startsWith('<')) {
    const closeAngle = rest.indexOf('>');
    if (closeAngle === -1 || rest[closeAngle + 1] !== ')') return null;
    return { label, href: rest.slice(1, closeAngle).trim() };
  }

  const hrefMatch = rest.match(/^(.+\.(?:md|html))\)\s*$/i);
  if (!hrefMatch) return null;

  return { label, href: hrefMatch[1].trim() };
}

function ensureSection(sections: IndexSection[], current: IndexSection | null, title = ''): IndexSection {
  if (current && current.title === title) return current;
  const section: IndexSection = { title, links: [] };
  sections.push(section);
  return section;
}

export function parseIndexFile(filePath: string, wordsRoot: string): IndexPage {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(wordsRoot, filePath).replace(/\\/g, '/');
  const lines = raw.split('\n');

  let title = 'Раздел';
  const introLines: string[] = [];
  const sections: IndexSection[] = [];
  const links: IndexLink[] = [];
  let currentSection: IndexSection | null = null;
  let seenSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      seenSection = true;
      currentSection = ensureSection(sections, null, h2[1].trim());
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      title = h1[1].trim();
      continue;
    }

    const linkMatch = parseMarkdownLinkLine(trimmed);
    if (linkMatch) {
      const rawHref = linkMatch.href;
      const link: IndexLink = {
        label: linkMatch.label,
        href: mdLinkToHtml(rawHref),
        resolvedHref: resolveIndexLinkHref(rawHref, relativePath),
      };
      links.push(link);

      if (!currentSection) {
        currentSection = ensureSection(sections, currentSection);
      }
      currentSection.links.push(link);
      continue;
    }

    if (!seenSection && trimmed && !trimmed.startsWith('[')) {
      introLines.push(trimmed);
    }
  }

  return {
    title,
    intro: introLines.join('\n').trim(),
    sections,
    links,
    sourcePath: relativePath,
  };
}

export function buildSlugIndexMap(indexes: IndexPage[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  function add(slug: string, topic: string) {
    if (!topic || topic === 'Слова') return;
    const list = map.get(slug) ?? [];
    if (!list.includes(topic)) list.push(topic);
    map.set(slug, list);
  }

  for (const page of indexes) {
    for (const section of page.sections) {
      for (const link of section.links) {
        add(link.resolvedHref.replace(/\.html$/i, ''), section.title);
      }
    }
  }

  return map;
}

export function indexOutputPath(relativePath: string): string {
  if (relativePath.toLowerCase() === 'readme.md') {
    return 'index.html';
  }
  const dir = relativePath.replace(/readme\.md$/i, '');
  return `${dir}index.html`;
}
