export interface WordFrontmatter {
  level: string;
  topics: string[];
  tags: string[];
  type: string;
  /** Номер урока (для песен и др.) */
  lesson: number | null;
}

const EMPTY: WordFrontmatter = {
  level: '',
  topics: [],
  tags: [],
  type: '',
  lesson: null,
};

function parseScalarList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return [trimmed.replace(/^['"]|['"]$/g, '')];
}

/** Minimal YAML frontmatter parser for word metadata. */
export function parseFrontmatter(raw: string): {
  frontmatter: WordFrontmatter;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: { ...EMPTY }, body: raw };
  }

  const frontmatter: WordFrontmatter = { ...EMPTY };
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();
    if (key === 'level') frontmatter.level = value.replace(/^['"]|['"]$/g, '');
    else if (key === 'topics') frontmatter.topics = parseScalarList(value);
    else if (key === 'tags') frontmatter.tags = parseScalarList(value);
    else if (key === 'type') frontmatter.type = value.replace(/^['"]|['"]$/g, '');
    else if (key === 'lesson') {
      const n = parseInt(value.replace(/^['"]|['"]$/g, ''), 10);
      if (!Number.isNaN(n) && n > 0) frontmatter.lesson = n;
    }
  }

  return { frontmatter, body: raw.slice(match[0].length) };
}

export function topicSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .slice(0, 48) || 'topic';
}
