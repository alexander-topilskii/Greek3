import path from 'path';
import type { GreekFormTarget } from './greek-lookup';
import { analyzeSongLineTokens } from './song-line-tokens';
import type { CatalogWord, Song, VerbCatalog, WordEntry } from './types';
import { buildCatalogWord, wordOutputPath } from './render';

export function songCatalogPageDir(songSlug: string): string {
  return `words/${songSlug}`;
}

export function buildSongCatalog(
  song: Song,
  lookup: Map<string, GreekFormTarget[]>,
  wordsBySlug: Map<string, WordEntry>,
): VerbCatalog {
  const deckId = song.slug.replace(/\//g, '-');
  const pageId = song.slug;
  const songHtmlDir = path.dirname(`words/${song.slug}.html`);
  const seen = new Set<string>();
  const words: CatalogWord[] = [];

  for (const line of song.lines) {
    for (const token of analyzeSongLineTokens(line.greek, lookup)) {
      const slug = token.target?.slug;
      if (!slug || seen.has(slug)) continue;
      const word = wordsBySlug.get(slug);
      if (!word) continue;
      seen.add(slug);
      const wordHtml = wordOutputPath(word.slug);
      const href = path.relative(songHtmlDir, wordHtml).replace(/\\/g, '/');
      const label = token.target?.label || word.translation || word.title;
      words.push(buildCatalogWord(word, href, label));
    }
  }

  return { deckId, pageId, words };
}
