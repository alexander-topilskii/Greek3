import fs from 'fs';
import path from 'path';
import { buildSlugIndexMap, indexOutputPath, parseIndexFile } from './parse-index';
import { sortLessonIndexPage, collectBlockAssignments } from './catalog-order';
import { isWordFile, parseWordFile } from './parse-word';
import { parseEssayFile } from './parse-essay';
import { parseSongFile } from './parse-song';
import {
  buildCatalogWord,
  buildSearchIndex,
  outputDirFor,
  renderCasesIndex,
  renderCasesCategoryIndex,
  renderAdverbsIndex,
  renderAdverbCategoryIndex,
  renderCasesPractice,
  renderEssay,
  renderSong,
  renderSongLine,
  songLineBreadcrumbLabel,
  renderBookChapter,
  renderBooksIndex,
  renderFavorites,
  renderHome,
  renderIndex,
  renderSearch,
  renderSettings,
  renderWord,
  sitePath,
  wordOutputPath,
} from './render';
import { parseBookChapter } from './parse-book';
import { writeManifest, writeServiceWorker } from './pwa';
import { enrichWordEntry, buildLevelAggregates, buildTopicAggregates } from './meta';
import type { CatalogWord, EssayTopic, Song, VerbCatalog, WordEntry } from './types';
import { HOME_SECTIONS } from './constants';
import {
  buildCatalogForIndex,
  buildGlobalCatalog,
  buildPagesMap,
  renderTopicLevelPages,
  wordFromIndexLink,
  writeCatalog,
} from './catalog-build';
import { breadcrumbsForWord, breadcrumbsForIndex } from './breadcrumbs';
import { BUILD_VERSION } from './build-version';
import { buildGreekFormLookup } from './greek-lookup';
import { buildSongCatalog, songCatalogPageDir } from './build-song-catalog';
import { songLineOutputPath } from './song-line-path';
import {
  BOOKS_DIR,
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
  console.log(`🏗  Building Greek3 site… ${BUILD_VERSION}`);

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
  const wordRenderQueue: WordEntry[] = [];
  const wordsByHref = new Map<string, WordEntry>();
  const wordsBySlug = new Map<string, WordEntry>();
  const essayTopics: EssayTopic[] = [];
  const songs: Song[] = [];

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
    const relLower = relative.replace(/\\/g, '/').toLowerCase();
    if (relLower === 'readme.md') continue;
    if (relLower.endsWith('readme.md')) continue;

    if (relLower.startsWith('essays/')) {
      essayTopics.push(parseEssayFile(file, WORDS_DIR));
      continue;
    }

    if (relLower.startsWith('songs/')) {
      songs.push(parseSongFile(file, WORDS_DIR));
      continue;
    }

    if (isWordFile(relative)) {
      const parsed = parseWordFile(file, WORDS_DIR);
      const slugKey = parsed.slug;
      const inferredTopics = slugTopicMap.get(slugKey) ?? [];
      const word = enrichWordEntry(parsed, inferredTopics);
      words.push(word);
      wordRenderQueue.push(word);
      wordsBySlug.set(word.slug, word);
      const href = `${path.basename(file).replace(/\.md$/i, '')}.html`;
      wordsByHref.set(href, word);
    }
  }

  const blockBySlug = collectBlockAssignments(indexPages, (link) =>
    wordFromIndexLink(link, wordsBySlug, wordsByHref),
  );
  for (const word of words) {
    const block = blockBySlug.get(word.slug);
    if (block != null) word.block = block;
  }

  const greekFormLookup = buildGreekFormLookup(words);
  const deckCatalogs: Record<string, VerbCatalog> = {};

  for (const word of wordRenderQueue) {
    const out = wordOutputPath(word.slug);
    writeHtml(out, renderWord(word, breadcrumbsForWord(word), greekFormLookup));
    console.log(`  📘 ${out}`);
  }

  for (const topic of essayTopics) {
    const crumbs = [
      { label: 'Главная', href: sitePath('index.html') },
      { label: 'Сочинения', href: sitePath('words/essays/index.html') },
      { label: topic.title },
    ];
    const out = `words/${topic.slug}.html`;
    writeHtml(out, renderEssay(topic, crumbs));
    console.log(`  ✍️  ${out}`);
  }

  for (const song of songs) {
    const songPageHref = sitePath(`words/${song.slug}.html`);
    const crumbs = [
      { label: 'Главная', href: sitePath('index.html') },
      { label: 'Песни', href: sitePath('words/songs/index.html') },
      { label: song.title },
    ];
    const catalog = buildSongCatalog(song, greekFormLookup, wordsBySlug);
    const songPageDir = songCatalogPageDir(song.slug);
    writeCatalog(songPageDir, catalog);
    if (catalog.words.length > 0 && catalog.deckId) {
      deckCatalogs[catalog.deckId] = catalog;
    }

    const out = `words/${song.slug}.html`;
    writeHtml(out, renderSong(song, crumbs, catalog.words.length > 0 ? catalog : undefined));
    console.log(`  🎵 ${out}${catalog.words.length ? ` (+ ${catalog.words.length} слов)` : ''}`);

    song.lines.forEach((line, lineIndex) => {
      const lineCrumbs = [
        { label: 'Главная', href: sitePath('index.html') },
        { label: 'Песни', href: sitePath('words/songs/index.html') },
        { label: song.title, href: songPageHref },
        { label: songLineBreadcrumbLabel(line) },
      ];
      const lineOut = songLineOutputPath(song.slug, lineIndex);
      writeHtml(
        lineOut,
        renderSongLine(song, lineIndex, line, lineCrumbs, greekFormLookup),
      );
    });
  }

  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);
    if (!relative.toLowerCase().endsWith('readme.md')) continue;

    const parsedIndex = parseIndexFile(file, WORDS_DIR);
    const index = sortLessonIndexPage(parsedIndex, (link) =>
      wordFromIndexLink(link, wordsBySlug, wordsByHref),
    );
    const out =
      relative.toLowerCase() === 'readme.md'
        ? 'words/index.html'
        : `words/${indexOutputPath(relative)}`;
    const pageDir = outputDirFor(out);
    const catalog = buildCatalogForIndex(index, wordsBySlug, wordsByHref, pageDir);
    writeCatalog(pageDir, catalog);
    if (catalog.words.length > 0 && catalog.deckId) {
      deckCatalogs[catalog.deckId] = catalog;
    }

    const html =
      relative.toLowerCase() === 'cases/readme.md'
        ? renderCasesIndex(
            index,
            pageDir,
            breadcrumbsForIndex(relative, index.title),
            catalog.words.length > 0 ? catalog : undefined,
          )
        : relative.toLowerCase().startsWith('cases/') && relative.toLowerCase().endsWith('readme.md')
        ? renderCasesCategoryIndex(
            index,
            pageDir,
            breadcrumbsForIndex(relative, index.title),
            catalog.words.length > 0 ? catalog : undefined,
          )
        : relative.toLowerCase() === 'adverbs/readme.md'
        ? renderAdverbsIndex(
            index,
            pageDir,
            breadcrumbsForIndex(relative, index.title),
            catalog.words.length > 0 ? catalog : undefined,
          )
        : relative.toLowerCase().startsWith('adverbs/') && relative.toLowerCase().endsWith('readme.md')
        ? renderAdverbCategoryIndex(
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
  for (const topic of topicAggregates) {
    if (topic.words.length > 0) {
      deckCatalogs[`topic-${topic.slug}`] = { deckId: `topic-${topic.slug}`, words: topic.words };
    }
  }
  for (const level of levelAggregates) {
    const slug = level.level.toLowerCase();
    if (level.words.length > 0) {
      deckCatalogs[`level-${slug}`] = { deckId: `level-${slug}`, words: level.words };
    }
  }

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
  deckCatalogs.global = globalCatalog;

  writeHtml('index.html', renderHome([...HOME_SECTIONS], globalCatalog));
  console.log('  🏠 index.html');

  writeHtml('words/favorites/index.html', renderFavorites(globalCatalog));
  console.log('  ★ words/favorites/index.html');

  const searchIndex = buildSearchIndex(globalWords);
  writeHtml('search.html', renderSearch(searchIndex));
  console.log(`  🔍 search.html (${searchIndex.length} words)`);

  // Build Books
  const booksSummaries = [];
  const dverDir = path.join(BOOKS_DIR, 'dver-v-leto');
  if (fs.existsSync(dverDir)) {
    const chapterFiles = fs
      .readdirSync(dverDir)
      .filter((f) => /^glava-\d+\.md$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)![0], 10);
        const numB = parseInt(b.match(/\d+/)![0], 10);
        return numA - numB;
      });

    if (chapterFiles.length > 0) {
      const parsedChapters = chapterFiles.map((file) => {
        const num = parseInt(file.match(/\d+/)![0], 10);
        const filePath = path.join(dverDir, file);
        const parsed = parseBookChapter(filePath, 'dver-v-leto', String(num));
        return { num, file, parsed };
      });

      const bookChaptersSummary = [];

      for (let i = 0; i < parsedChapters.length; i++) {
        const current = parsedChapters[i];
        const numStr = String(current.num).padStart(2, '0');
        const chapterHtmlName = `glava-${numStr}.html`;
        const chapterHref = sitePath(`books/dver-v-leto/${chapterHtmlName}`);

        const prev =
          i > 0
            ? {
                href: sitePath(`books/dver-v-leto/glava-${String(parsedChapters[i - 1].num).padStart(2, '0')}.html`),
                label: `Глава ${parsedChapters[i - 1].num}`,
              }
            : undefined;

        const next =
          i < parsedChapters.length - 1
            ? {
                href: sitePath(`books/dver-v-leto/glava-${String(parsedChapters[i + 1].num).padStart(2, '0')}.html`),
                label: `Глава ${parsedChapters[i + 1].num}`,
              }
            : undefined;

        const chapterCrumbs = [
          { label: 'Книги', href: sitePath('books/index.html') },
          { label: 'Дверь в лето', href: sitePath('books/dver-v-leto/index.html') },
          { label: `Глава ${current.num}` },
        ];

        const chapterHtml = renderBookChapter(current.parsed, words, chapterCrumbs, { prev, next });
        writeHtml(`books/dver-v-leto/${chapterHtmlName}`, chapterHtml);
        if (current.num === 1) {
          writeHtml('books/dver-v-leto/index.html', chapterHtml);
        }
        console.log(`  📖 books/dver-v-leto/${chapterHtmlName}`);

        bookChaptersSummary.push({
          id: String(current.num),
          num: current.num,
          title: current.parsed.chapterTitle,
          href: current.num === 1 ? sitePath('books/dver-v-leto/index.html') : chapterHref,
        });
      }

      booksSummaries.push({
        id: 'dver-v-leto',
        title: 'Роберт Хайнлайн — «Дверь в лето»',
        author: 'Роберт Хайнлайн',
        greekTitle: 'Η Πόρτα για το Καλοκαίρι',
        level: 'A1–A2',
        description:
          'Знаменитый научно-фантастический роман о коте Пите, инженере Дэне и поисках Двери в Лето, адаптированный простыми и чистыми греческими конструкциями строго на базе словаря проекта Greek3.',
        chapters: bookChaptersSummary,
      });
    }
  }

  if (booksSummaries.length > 0) {
    const booksIndexCrumbs = [{ label: 'Книги' }];
    writeHtml('books/index.html', renderBooksIndex(booksSummaries, booksIndexCrumbs));
    console.log('  📚 books/index.html');
  }

  writeHtml('settings.html', renderSettings(deckCatalogs));
  console.log('  ⚙️  settings.html');

  const baseUrl = process.env.SITE_BASE_URL ?? '';
  const buildId = process.env.BUILD_ID ?? 'dev';
  writeManifest(DIST_DIR, baseUrl);
  writeServiceWorker(DIST_DIR, baseUrl, buildId);
  console.log('  📱 manifest.webmanifest + sw.js');

  console.log(`✅ Done — ${words.length} word(s), output: dist/`);
}

main();
