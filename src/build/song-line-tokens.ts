import { resolveGreekFormLink, type GreekFormTarget } from './greek-lookup';
import { tokenizeGreekLine } from './tokenize-greek-line';

export interface SongLineToken {
  surface: string;
  target: GreekFormTarget | null;
}

export function analyzeSongLineTokens(
  greek: string,
  lookup: Map<string, GreekFormTarget[]>,
): SongLineToken[] {
  return tokenizeGreekLine(greek).map((surface) => ({
    surface,
    target: resolveGreekFormLink(lookup, surface, ''),
  }));
}
