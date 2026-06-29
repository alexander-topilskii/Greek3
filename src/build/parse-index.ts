import fs from 'fs';
import path from 'path';
import type { IndexLink, IndexPage, IndexSection, IndexSubSection } from './types';

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

function ensureSection(sections: IndexSection[], title = ''): IndexSection {
  let section = sections.find((s) => s.title === title);
  if (!section) {
    section = { title, links: [], subsections: [] };
    sections.push(section);
  }
  return section;
}

function ensureSubsection(section: IndexSection, title: string): IndexSubSection {
  let subsection = section.subsections.find((s) => s.title === title);
  if (!subsection) {
    subsection = { title, links: [] };
    section.subsections.push(subsection);
  }
  return subsection;
}

function pageKindFromPath(relativePath: string): IndexPage['pageKind'] {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  if (normalized.startsWith('lessons/')) return 'lesson';
  if (normalized.startsWith('topics/')) return 'topics';
  if (normalized.startsWith('levels/')) return 'levels';
  return 'default';
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
  let currentSubsection: IndexSubSection | null = null;
  let seenSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      seenSection = true;
      if (!currentSection) {
        currentSection = ensureSection(sections);
      }
      currentSubsection = ensureSubsection(currentSection, h3[1].trim());
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      seenSection = true;
      currentSubsection = null;
      currentSection = ensureSection(sections, h2[1].trim());
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      title = h1[1].trim();
      continue;
    }

    const linkMatch = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const rawHref = linkMatch[2].trim();
      const link: IndexLink = {
        label: linkMatch[1].trim(),
        href: mdLinkToHtml(rawHref),
        resolvedHref: resolveIndexLinkHref(rawHref, relativePath),
      };
      links.push(link);

      if (!currentSection) {
        currentSection = ensureSection(sections);
      }

      if (currentSubsection) {
        currentSubsection.links.push(link);
      } else {
        currentSection.links.push(link);
      }
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
    pageKind: pageKindFromPath(relativePath),
  };
}

export function indexOutputPath(relativePath: string): string {
  if (relativePath.toLowerCase() === 'readme.md') {
    return 'index.html';
  }
  const dir = relativePath.replace(/readme\.md$/i, '');
  return `${dir}index.html`;
}

export interface SlugIndexInfo {
  sectionTitle: string;
  subsectionTitle: string;
  indexPath: string;
}

/** Map word slug -> section titles from readme listings. */
export function buildSlugIndexMap(
  indexes: IndexPage[],
): Map<string, SlugIndexInfo[]> {
  const map = new Map<string, SlugIndexInfo[]>();

  function add(slugKey: string, info: SlugIndexInfo) {
    const list = map.get(slugKey) ?? [];
    list.push(info);
    map.set(slugKey, list);
  }

  for (const page of indexes) {
    for (const section of page.sections) {
      const sectionTitle = section.title;
      for (const link of section.links) {
        const slug = link.resolvedHref.replace(/\.html$/i, '');
        add(slug, {
          sectionTitle,
          subsectionTitle: '',
          indexPath: page.sourcePath,
        });
      }
      for (const subsection of section.subsections) {
        for (const link of subsection.links) {
          const slug = link.resolvedHref.replace(/\.html$/i, '');
          add(slug, {
            sectionTitle,
            subsectionTitle: subsection.title,
            indexPath: page.sourcePath,
          });
        }
      }
    }
    for (const link of page.links) {
      if (page.sourcePath.toLowerCase().includes('lessons/') && link.resolvedHref.includes('/')) {
        const slug = link.resolvedHref.replace(/\.html$/i, '');
        add(slug, { sectionTitle: 'Урок', subsectionTitle: '', indexPath: page.sourcePath });
      }
    }
  }

  return map;
}

export function inferredTopicsForSlug(
  slugIndexMap: Map<string, SlugIndexInfo[]>,
  slug: string,
): string[] {
  const infos = slugIndexMap.get(slug) ?? [];
  const topics = new Set<string>();
  for (const info of infos) {
    if (info.sectionTitle && info.sectionTitle !== 'Слова' && info.sectionTitle !== 'Урок') {
      topics.add(info.sectionTitle);
    }
    if (info.subsectionTitle) topics.add(info.subsectionTitle);
  }
  return [...topics];
}
