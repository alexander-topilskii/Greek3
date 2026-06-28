import fs from 'fs';
import path from 'path';
import type { IndexLink, IndexPage } from './types';

function mdLinkToHtml(href: string): string {
  if (href.toLowerCase().endsWith('readme.md')) {
    return href.replace(/readme\.md$/i, 'index.html');
  }
  if (href.endsWith('.md')) {
    return href.replace(/\.md$/i, '.html');
  }
  return href;
}

export function parseIndexFile(filePath: string, wordsRoot: string): IndexPage {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(wordsRoot, filePath);
  const lines = raw.split('\n');

  let title = 'Раздел';
  const links: IndexLink[] = [];

  for (const line of lines) {
    const heading = line.match(/^#\s+(.+)$/);
    if (heading) {
      title = heading[1].trim();
      continue;
    }

    const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      links.push({
        label: linkMatch[1].trim(),
        href: mdLinkToHtml(linkMatch[2].trim()),
      });
    }
  }

  return { title, links, sourcePath: relativePath };
}

export function indexOutputPath(relativePath: string): string {
  if (relativePath.toLowerCase() === 'readme.md') {
    return 'index.html';
  }
  const dir = relativePath.replace(/readme\.md$/i, '');
  return `${dir}index.html`;
}
