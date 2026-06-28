import fs from 'fs';
import path from 'path';
import { indexOutputPath, parseIndexFile } from './parse-index';
import { isWordFile, parseWordFile } from './parse-word';
import {
  buildCatalogWord,
  outputDirFor,
  renderHome,
  renderIndex,
  renderWord,
  sitePath,
  wordOutputPath,
} from './render';
import type { VerbCatalog, WordEntry } from './types';

const ROOT = path.resolve(__dirname, '../..');
const WORDS_DIR = path.join(ROOT, 'words');
const SITE_DIR = path.join(ROOT, 'site');
const DIST_DIR = path.join(ROOT, 'dist');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src: string, dest: string): void {
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

function walkMdFiles(dir: string): string[] {
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

function writeHtml(relativePath: string, html: string): void {
  const out = path.join(DIST_DIR, relativePath);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, html, 'utf-8');
}

function breadcrumbsForWord(entry: WordEntry) {
  return [
    { label: 'Главная', href: sitePath('index.html') },
    ...(entry.category
      ? [{ label: entry.category, href: sitePath(`words/${entry.category}/index.html`) }]
      : []),
    { label: entry.translation || entry.title },
  ];
}

function breadcrumbsForIndex(
  relativePath: string,
  title: string,
): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: 'Главная', href: sitePath('index.html') },
  ];
  if (relativePath.toLowerCase() !== 'readme.md') {
    crumbs.push({ label: title });
  }
  return crumbs;
}

function main(): void {
  console.log('🏗  Building Greek3 site...');

  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);

  copyDir(SITE_DIR, path.join(DIST_DIR, 'assets'));

  const serveConfig = path.join(SITE_DIR, 'serve.json');
  if (fs.existsSync(serveConfig)) {
    fs.copyFileSync(serveConfig, path.join(DIST_DIR, 'serve.json'));
  }

  const mdFiles = walkMdFiles(WORDS_DIR);
  const words: WordEntry[] = [];
  const wordsByHref = new Map<string, WordEntry>();

  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);

    if (relative.toLowerCase() === 'readme.md') continue;

    if (relative.toLowerCase().endsWith('readme.md')) continue;

    if (isWordFile(relative)) {
      const word = parseWordFile(file, WORDS_DIR);
      words.push(word);
      const href = `${path.basename(file).replace(/\.md$/i, '')}.html`;
      wordsByHref.set(href, word);
      const out = wordOutputPath(word.slug);
      const html = renderWord(word, breadcrumbsForWord(word));
      writeHtml(out, html);
      console.log(`  📘 ${out}`);
    }
  }

  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);

    if (relative.toLowerCase() === 'readme.md') continue;

    if (relative.toLowerCase().endsWith('readme.md')) {
      const index = parseIndexFile(file, WORDS_DIR);
      const out = `words/${indexOutputPath(relative)}`;
      const pageDir = outputDirFor(out);
      const deckId = pageDir.split('/').pop() ?? 'default';

      const catalog: VerbCatalog = {
        deckId,
        words: index.links
          .map((link) => {
            const word = wordsByHref.get(link.href);
            if (!word) return null;
            return buildCatalogWord(word, link.href, link.label);
          })
          .filter(Boolean) as VerbCatalog['words'],
      };

      const catalogPath = path.join(DIST_DIR, pageDir, 'catalog.json');
      ensureDir(path.dirname(catalogPath));
      fs.writeFileSync(catalogPath, JSON.stringify(catalog), 'utf-8');

      const html = renderIndex(
        index,
        pageDir,
        breadcrumbsForIndex(relative, index.title),
        catalog,
      );
      writeHtml(out, html);
      console.log(`  📄 ${out} (+ catalog ${catalog.words.length} words)`);
    }
  }

  const homeSections = [
    {
      title: 'Глаголы',
      href: 'words/verbs/index.html',
      description: 'Спряжения, времена и формы глаголов',
    },
    {
      title: 'Падежи',
      href: '#',
      description: 'Скоро — падежи и их употребление',
    },
    {
      title: 'Частицы',
      href: '#',
      description: 'Скоро — частицы и служебные слова',
    },
  ];

  writeHtml('index.html', renderHome(homeSections));
  console.log('  🏠 index.html');
  console.log(`✅ Done — ${words.length} word(s), output: dist/`);
}

main();
