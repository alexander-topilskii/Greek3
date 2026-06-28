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

function ensureSection(sections: IndexSection[], current: IndexSection | null, title = ''): IndexSection {
  if (current && current.title === title) return current;
  const section: IndexSection = { title, links: [] };
  sections.push(section);
  return section;
}

export function parseIndexFile(filePath: string, wordsRoot: string): IndexPage {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(wordsRoot, filePath);
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

    const linkMatch = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const link: IndexLink = {
        label: linkMatch[1].trim(),
        href: mdLinkToHtml(linkMatch[2].trim()),
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

export function indexOutputPath(relativePath: string): string {
  if (relativePath.toLowerCase() === 'readme.md') {
    return 'index.html';
  }
  const dir = relativePath.replace(/readme\.md$/i, '');
  return `${dir}index.html`;
}
