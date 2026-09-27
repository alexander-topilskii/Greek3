export function songLineOutputPath(songSlug: string, lineIndex: number): string {
  return `words/${songSlug}/line-${lineIndex}.html`;
}
