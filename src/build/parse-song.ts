import fs from 'fs';
import path from 'path';
import { parsePairs } from './parse-essay';
import { parseFrontmatter } from './parse-frontmatter';
import type { Song } from './types';

function slugFromPath(relativePath: string): string {
  return relativePath.replace(/\.md$/i, '').replace(/\\/g, '/');
}

function titleFromSlug(slug: string): string {
  const name = slug.split('/').pop() ?? slug;
  return decodeURIComponent(name);
}

const LYRICS_KEYS = ['текст', 'текст песни', 'lyrics'];

export function parseSongFile(filePath: string, wordsRoot: string): Song {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const relativePath = path.relative(wordsRoot, filePath).replace(/\\/g, '/');
  const slug = slugFromPath(relativePath);

  const lines = body.split('\n');

  let title = titleFromSlug(slug);
  const introLines: string[] = [];
  const sections = new Map<string, string[]>();
  let currentKey: string | null = null;
  let seenSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      title = h1[1].trim();
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      seenSection = true;
      currentKey = h2[1].trim().toLowerCase();
      if (!sections.has(currentKey)) sections.set(currentKey, []);
      continue;
    }

    if (currentKey) {
      sections.get(currentKey)!.push(line);
    } else if (!seenSection && trimmed) {
      introLines.push(trimmed);
    }
  }

  function sectionLines(keys: string[]): string[] {
    for (const [key, value] of sections) {
      if (keys.includes(key)) return value;
    }
    return [];
  }

  return {
    slug,
    title,
    intro: introLines.join('\n').trim(),
    lesson: frontmatter.lesson,
    lines: parsePairs(sectionLines(LYRICS_KEYS)),
    sourcePath: relativePath,
  };
}
