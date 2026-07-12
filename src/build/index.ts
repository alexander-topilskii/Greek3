import fs from 'fs';
import path from 'path';
import { buildSlugIndexMap, indexOutputPath, parseIndexFile } from './parse-index';
import { isWordFile, parseWordFile } from './parse-word';
import {
  buildCatalogWord,
  buildSearchIndex,
  outputDirFor,
  renderCasesIndex,
  renderCasesPractice,
  renderHome,
  renderIndex,
  renderSearch,
  renderWord,
  wordOutputPath,
} from './render';
import { writeManifest, writeServiceWorker } from './pwa';
import { enrichWordEntry, buildLevelAggregates, buildTopicAggregates } from './meta';
import type { CatalogWord, WordEntry } from './types';
import { HOME_SECTIONS } from './constants';
import {
  buildCatalogForIndex,
  buildGlobalCatalog,
  buildPagesMap,
  renderTopicLevelPages,
  writeCatalog,
} from './catalog-build';
import { breadcrumbsForWord, breadcrumbsForIndex } from './breadcrumbs';
import {
  DIST_DIR,
  SITE_DIR,
  WORDS_DIR,
  buildMainCss,
  copyDir,
  ensureDir,
  walkMdFiles,
  writeHtml,
} from './fs';

function main(): void {
  console.log('🏗  Building Greek3 site...');

  buildMainCss();

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
  const wordsBySlug = new Map<string, WordEntry>();

  const casesGamePath = path.join(SITE_DIR, 'data', 'cases-game.json');
  const casesGameData = fs.existsSync(casesGamePath)
    ? JSON.parse(fs.readFileSync(casesGamePath, 'utf-8'))
    : { items: [] };

  const indexPages = [];
  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);
    if (!relative.toLowerCase().endsWith('readme.md')) continue;
    indexPages.push(parseIndexFile(file, WORDS_DIR));
  }
  const slugTopicMap = buildSlugIndexMap(indexPages);

  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);
    if (relative.toLowerCase() === 'readme.md') continue;
    if (relative.toLowerCase().endsWith('readme.md')) continue;

    if (isWordFile(relative)) {
      const parsed = parseWordFile(file, WORDS_DIR);
      const slugKey = parsed.slug;
      const inferredTopics = slugTopicMap.get(slugKey) ?? [];
      const word = enrichWordEntry(parsed, inferredTopics);
      words.push(word);
      wordsBySlug.set(word.slug, word);
      const href = `${path.basename(file).replace(/\.md$/i, '')}.html`;
      wordsByHref.set(href, word);
      const out = wordOutputPath(word.slug);
      writeHtml(out, renderWord(word, breadcrumbsForWord(word)));
      console.log(`  📘 ${out}`);
    }
  }

  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);
    if (!relative.toLowerCase().endsWith('readme.md')) continue;

    const index = parseIndexFile(file, WORDS_DIR);
    const out =
      relative.toLowerCase() === 'readme.md'
        ? 'words/index.html'
        : `words/${indexOutputPath(relative)}`;
    const pageDir = outputDirFor(out);
    const catalog = buildCatalogForIndex(index, wordsBySlug, wordsByHref, pageDir);
    writeCatalog(pageDir, catalog);

    const html =
      relative.toLowerCase() === 'cases/readme.md'
        ? renderCasesIndex(
            index,
            pageDir,
            breadcrumbsForIndex(relative, index.title),
            catalog.words.length > 0 ? catalog : undefined,
          )
        : renderIndex(
            index,
            pageDir,
            breadcrumbsForIndex(relative, index.title),
            catalog.words.length > 0 ? catalog : undefined,
          );
    writeHtml(out, html);
    console.log(`  📄 ${out} (+ catalog ${catalog.words.length} words)`);

    if (relative.toLowerCase() === 'cases/readme.md') {
      const practiceOut = 'words/cases/practice.html';
      const practiceCrumbs = [
        ...breadcrumbsForIndex(relative, index.title),
        { label: 'Тренировка падежей' },
      ];
      writeHtml(practiceOut, renderCasesPractice(casesGameData, practiceCrumbs));
      console.log(`  🎯 ${practiceOut}`);
    }
  }

  const globalWords: CatalogWord[] = words.map((word) => {
    const fileName = `${path.basename(word.sourcePath).replace(/\.md$/i, '')}.html`;
    return buildCatalogWord(word, `${word.category}/${fileName}`, word.translation || word.title);
  });

  renderTopicLevelPages(globalWords);

  const topicAggregates = buildTopicAggregates(globalWords);
  const levelAggregates = buildLevelAggregates(globalWords);
  const extraPageCatalogs = [
    ...topicAggregates.map((t) => ({
      pageId: `topics/${t.slug}`,
      words: t.words,
      subsectionTitles: ['Все записи'],
    })),
    ...levelAggregates.map((l) => ({
      pageId: `levels/${l.level.toLowerCase()}`,
      words: l.words,
      subsectionTitles: ['Все записи'],
    })),
  ];
  const pagesMap = buildPagesMap(indexPages, wordsBySlug, wordsByHref, extraPageCatalogs);
  const globalCatalog = buildGlobalCatalog(
    indexPages,
    words,
    wordsBySlug,
    wordsByHref,
    pagesMap,
  );
  writeCatalog('', globalCatalog);

  writeHtml('index.html', renderHome([...HOME_SECTIONS], globalCatalog));
  console.log('  🏠 index.html');

  const searchIndex = buildSearchIndex(globalWords);
  writeHtml('search.html', renderSearch(searchIndex));
  console.log(`  🔍 search.html (${searchIndex.length} words)`);

  const baseUrl = process.env.SITE_BASE_URL ?? '';
  const buildId = process.env.BUILD_ID ?? 'dev';
  writeManifest(DIST_DIR, baseUrl);
  writeServiceWorker(DIST_DIR, baseUrl, buildId);
  console.log('  📱 manifest.webmanifest + sw.js');

  console.log(`✅ Done — ${words.length} word(s), output: dist/`);
}

main();
