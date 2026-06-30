import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from './parse-frontmatter';
import type { WordEntry, WordForm, WordMeta } from './types';

const SECTION_BASE = 'база';
const SECTION_FORMS = 'формы';
const SECTION_TYPE = 'тип';

function slugFromPath(relativePath: string): string {
  return relativePath.replace(/\.md$/i, '').replace(/\\/g, '/');
}

function titleFromSlug(slug: string): string {
  const name = slug.split('/').pop() ?? slug;
  return decodeURIComponent(name);
}

function parseSectionContent(lines: string[]): { title: string; lines: string[] }[] {
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = line.match(/^#\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  return sections;
}

function parseForms(lines: string[]): WordForm[] {
  const forms: WordForm[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dashIndex = trimmed.indexOf(' - ');
    if (dashIndex === -1) continue;

    forms.push({
      greek: trimmed.slice(0, dashIndex).trim(),
      translation: trimmed.slice(dashIndex + 3).trim(),
    });
  }

  return forms;
}

function parseBase(lines: string[]): { translation: string; baseForms: string[] } {
  const content = lines.map((l) => l.trim()).find(Boolean) ?? '';

  const colonIndex = content.indexOf(':');
  if (colonIndex === -1) {
    return { translation: content, baseForms: [] };
  }

  const translation = content.slice(0, colonIndex).trim();
  const formsPart = content.slice(colonIndex + 1).trim();
  const baseForms = formsPart
    .split('-')
    .map((f) => f.trim())
    .filter(Boolean);

  return { translation, baseForms };
}

export function parseWordFile(filePath: string, wordsRoot: string): WordEntry {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const relativePath = path.relative(wordsRoot, filePath);
  const slug = slugFromPath(relativePath);
  const category = slug.includes('/') ? slug.split('/')[0] : '';
  const sections = parseSectionContent(body.split('\n'));

  let translation = '';
  let verbType = '';
  let baseForms: string[] = [];
  let forms: WordForm[] = [];
  const extraSections: { title: string; lines: string[] }[] = [];

  const meta: WordMeta = {
    level: frontmatter.level,
    topics: frontmatter.topics,
    tags: frontmatter.tags,
    recordType: frontmatter.type,
  };

  for (const section of sections) {
    const key = section.title.toLowerCase();

    if (key === SECTION_BASE) {
      const parsed = parseBase(section.lines);
      translation = parsed.translation;
      baseForms = parsed.baseForms;
    } else if (key === SECTION_TYPE) {
      verbType = section.lines.map((l) => l.trim()).find(Boolean) ?? '';
    } else if (key === SECTION_FORMS) {
      forms = parseForms(section.lines);
    } else if (key === 'уровень' && !meta.level) {
      meta.level = section.lines.map((l) => l.trim()).find(Boolean) ?? '';
    } else {
      extraSections.push(section);
    }
  }

  return {
    slug,
    title: titleFromSlug(slug),
    category,
    translation,
    verbType,
    baseForms,
    forms,
    extraSections,
    sourcePath: relativePath,
    meta,
    primaryGreek: '',
  };
}

export function isWordFile(relativePath: string): boolean {
  const base = path.basename(relativePath).toLowerCase();
  return base.endsWith('.md') && base !== 'readme.md';
}

export function getSpecialSection(
  word: WordEntry,
  title: string,
): { title: string; lines: string[] } | null {
  const key = title.toLowerCase();
  return word.extraSections.find((s) => s.title.toLowerCase() === key) ?? null;
}
