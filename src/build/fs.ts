import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
export const WORDS_DIR = path.join(ROOT, 'words');
export const SITE_DIR = path.join(ROOT, 'site');
export const DIST_DIR = path.join(ROOT, 'dist');

const CSS_PARTS = [
  'tokens.css',
  'base.css',
  'word-page.css',
  'practice.css',
  'favorites.css',
  'cases.css',
  'cases-practice.css',
  'learning-ladder.css',
  'essays.css',
  'misc.css',
];

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function copyDir(src: string, dest: string): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function walkMdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

export function writeHtml(relativePath: string, html: string): void {
  const out = path.join(DIST_DIR, relativePath);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, html, 'utf-8');
}

export function writeJson(relativePath: string, data: unknown): void {
  const out = path.join(DIST_DIR, relativePath);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, JSON.stringify(data), 'utf-8');
}

/** Concatenate CSS partials into main.css for dist and local site. */
export function buildMainCss(): void {
  const partsDir = path.join(SITE_DIR, 'css', 'parts');
  if (!fs.existsSync(partsDir)) return;

  const chunks: string[] = [];
  for (const part of CSS_PARTS) {
    const partPath = path.join(partsDir, part);
    if (fs.existsSync(partPath)) {
      chunks.push(fs.readFileSync(partPath, 'utf-8'));
    }
  }
  if (!chunks.length) return;

  const combined = chunks.join('\n');
  fs.writeFileSync(path.join(SITE_DIR, 'css', 'main.css'), combined, 'utf-8');
}
