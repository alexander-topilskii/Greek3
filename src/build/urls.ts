/** Root-absolute path with per-segment encoding — works regardless of current URL. */
export function encodeSitePath(baseUrl: string, relativePath: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const normalized = relativePath.replace(/^\//, '');
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return base ? `${base}/${encoded}` : `/${encoded}`;
}
