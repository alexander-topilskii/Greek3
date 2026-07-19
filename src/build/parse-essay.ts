import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from './parse-frontmatter';
import type { EssayExample, EssayPair, EssayTopic } from './types';

function slugFromPath(relativePath: string): string {
  return relativePath.replace(/\.md$/i, '').replace(/\\/g, '/');
}

function titleFromSlug(slug: string): string {
  const name = slug.split('/').pop() ?? slug;
  return decodeURIComponent(name);
}

/** Разбивает строку `греч — перевод` (тире `—`, `–` или `-`). */
function parsePair(line: string): EssayPair | null {
  const content = line.trim().replace(/^[-*]\s*/, '');
  if (!content) return null;

  const parts = content.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return null;

  const greek = parts[0].replace(/\*\*/g, '').trim();
  const translation = parts.slice(1).join(' — ').replace(/\*\*/g, '').trim();
  if (!greek || !translation) return null;

  return { greek, translation };
}

function parsePairs(lines: string[]): EssayPair[] {
  const pairs: EssayPair[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-') && !trimmed.startsWith('*')) continue;
    const pair = parsePair(trimmed);
    if (pair) pairs.push(pair);
  }
  return pairs;
}

/** Секция «Сочинения»: подзаголовки `### A1` с текстом до следующего `###`. */
function parseExamples(lines: string[]): EssayExample[] {
  const examples: EssayExample[] = [];
  let current: EssayExample | null = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      if (current) examples.push(current);
      current = { level: heading[1].trim(), body: '' };
      continue;
    }
    if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) examples.push(current);

  return examples.map((e) => ({ level: e.level, body: e.body.trim() }));
}

const QUESTION_KEYS = ['вопросы', 'вопросы для сочинения', 'темы для рассуждения'];
const VOCAB_KEYS = ['лексика', 'ключевая лексика', 'словарь'];
const PHRASE_KEYS = [
  'фразы',
  'ключевые фразы',
  'фразы и конструкции',
  'ключевые фразы и конструкции',
  'конструкции',
];
const EXAMPLE_KEYS = ['сочинения', 'примеры', 'примеры сочинений'];

export function parseEssayFile(filePath: string, wordsRoot: string): EssayTopic {
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
    level: frontmatter.level,
    questions: parsePairs(sectionLines(QUESTION_KEYS)),
    vocab: parsePairs(sectionLines(VOCAB_KEYS)),
    phrases: parsePairs(sectionLines(PHRASE_KEYS)),
    examples: parseExamples(sectionLines(EXAMPLE_KEYS)),
    sourcePath: relativePath,
  };
}
