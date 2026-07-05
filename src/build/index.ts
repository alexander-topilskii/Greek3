import fs from 'fs';
import path from 'path';
import {
  buildCatalogOrder,
  catalogWordExtras,
  CATEGORY_ORDER,
  CATALOG_BLOCK_SIZE,
  collectLessonWords,
  interleaveByCategory,
} from './catalog-order';
import { buildLevelAggregates, buildTopicAggregates, enrichWordEntry } from './meta';
import { buildSlugIndexMap, indexOutputPath, parseIndexFile } from './parse-index';
import { isWordFile, parseWordFile } from './parse-word';
import {
  buildCatalogWord,
  buildSearchIndex,
  outputDirFor,
  renderCasesIndex,
  renderHome,
  renderIndex,
  renderSearch,
  renderTopicLevelHub,
  renderWord,
  sitePath,
  syntheticIndexFromCatalog,
  wordOutputPath,
} from './render';
import type { CatalogWord, IndexLink, IndexPage, VerbCatalog, WordEntry } from './types';

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

function writeJson(relativePath: string, data: unknown): void {
  const out = path.join(DIST_DIR, relativePath);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, JSON.stringify(data), 'utf-8');
}

const CATEGORY_LABELS: Record<string, string> = {
  verbs: 'Глаголы',
  nouns: 'Существительные',
  adjectives: 'Прилагательные',
  pronouns: 'Местоимения',
  numbers: 'Числа',
  cases: 'Падежи и управление',
  particles: 'Частицы',
  phrases: 'Фразы',
  lessons: 'Уроки',
  topics: 'Темы',
  levels: 'Уровни',
};

function wordFromIndexLink(
  link: IndexLink,
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
): WordEntry | null {
  const key = link.resolvedHref.replace(/\.html$/i, '');
  const bySlug = wordsBySlug.get(key);
  if (bySlug) return bySlug;
  const base = path.basename(link.resolvedHref);
  return wordsByHref.get(base) ?? null;
}

function breadcrumbsForWord(entry: WordEntry) {
  return [
    { label: 'Главная', href: sitePath('index.html') },
    ...(entry.category
      ? [{
          label: CATEGORY_LABELS[entry.category] ?? entry.category,
          href: sitePath(`words/${entry.category}/index.html`),
        }]
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

  if (relativePath.toLowerCase() === 'readme.md') {
    crumbs.push({ label: title });
    return crumbs;
  }

  const category = relativePath.split('/')[0];
  if (category === 'lessons') {
    if (relativePath.toLowerCase() !== 'lessons/readme.md') {
      crumbs.push({ label: 'Уроки', href: sitePath('words/lessons/index.html') });
    }
    crumbs.push({ label: title });
    return crumbs;
  }

  if (category === 'topics') {
    crumbs.push({ label: 'Темы', href: sitePath('words/topics/index.html') });
    if (relativePath.toLowerCase() !== 'topics/readme.md') crumbs.push({ label: title });
    else crumbs[crumbs.length - 1] = { label: title };
    return crumbs;
  }

  if (category === 'levels') {
    crumbs.push({ label: 'Уровни', href: sitePath('words/levels/index.html') });
    if (relativePath.toLowerCase() !== 'levels/readme.md') crumbs.push({ label: title });
    else crumbs[crumbs.length - 1] = { label: title };
    return crumbs;
  }

  if (category && CATEGORY_LABELS[category]) {
    crumbs.push({ label: 'Словарь', href: sitePath('words/index.html') });
  }
  crumbs.push({ label: title });
  return crumbs;
}

function buildGlobalCatalog(
  indexPages: IndexPage[],
  words: WordEntry[],
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
): VerbCatalog {
  const seen = new Set<string>();
  const ordered: CatalogWord[] = [];

  function addCatalogItem(item: ReturnType<typeof buildCatalogOrder>[number]) {
    if (seen.has(item.word.slug)) return;
    seen.add(item.word.slug);
    ordered.push({
      ...buildCatalogWord(item.word, item.href, item.label),
      ...catalogWordExtras(item),
    });
  }

  const lessonHub = indexPages.find((p) => p.sourcePath.toLowerCase() === 'lessons/readme.md');
  const lessonWords = lessonHub
    ? collectLessonWords(indexPages, lessonHub, (link) =>
        wordFromIndexLink(link, wordsBySlug, wordsByHref),
      )
    : [];
  const lessonSlugs = new Set(lessonWords.map((lw) => lw.word.slug));

  const byCategory = new Map<string, WordEntry[]>();
  for (const word of words) {
    if (lessonSlugs.has(word.slug)) continue;
    const cat = word.category ?? 'other';
    const list = byCategory.get(cat) ?? [];
    list.push(word);
    byCategory.set(cat, list);
  }

  const interleaved = interleaveByCategory(byCategory, CATEGORY_ORDER);

  const interleavedSlugs = new Set(interleaved.map((w) => w.slug));
  const remaining: WordEntry[] = [];
  for (const word of words) {
    if (lessonSlugs.has(word.slug) || interleavedSlugs.has(word.slug)) continue;
    remaining.push(word);
  }
  remaining.sort((a, b) =>
    (a.translation || a.title).localeCompare(b.translation || b.title, 'ru'),
  );

  const hrefForWord = (word: WordEntry) => {
    const fileName = `${path.basename(word.sourcePath).replace(/\.md$/i, '')}.html`;
    return `${word.category}/${fileName}`;
  };
  const labelForWord = (word: WordEntry) => word.translation || word.title;

  const catalogItems = buildCatalogOrder(
    lessonWords,
    [...interleaved, ...remaining],
    hrefForWord,
    labelForWord,
  );

  for (const item of catalogItems) {
    addCatalogItem(item);
  }

  return { deckId: 'global', words: ordered, blockSize: CATALOG_BLOCK_SIZE, categoryLabels: CATEGORY_LABELS };
}

function buildCatalogForIndex(
  index: IndexPage,
  wordsBySlug: Map<string, WordEntry>,
  wordsByHref: Map<string, WordEntry>,
  pageDir: string,
): VerbCatalog {
  const deckId = pageDir.replace(/^words\/?/, '').replace(/\//g, '-') || 'default';
  return {
    deckId,
    words: index.links
      .map((link) => {
        const word = wordFromIndexLink(link, wordsBySlug, wordsByHref);
        if (!word) return null;
        return buildCatalogWord(word, link.resolvedHref, link.label);
      })
      .filter(Boolean) as CatalogWord[],
  };
}

function writeCatalog(pageDir: string, catalog: VerbCatalog): void {
  if (catalog.words.length === 0) return;
  writeJson(`${pageDir}/catalog.json`, catalog);
}

function renderTopicLevelPages(allWords: CatalogWord[]): void {
  const topicAggregates = buildTopicAggregates(allWords);
  const levelAggregates = buildLevelAggregates(allWords);

  writeHtml(
    'words/topics/index.html',
    renderTopicLevelHub(
      'Темы',
      topicAggregates.map((t) => ({
        title: t.title,
        href: `words/topics/${t.slug}/index.html`,
        count: t.words.length,
      })),
      breadcrumbsForIndex('topics/readme.md', 'Темы'),
    ),
  );

  for (const topic of topicAggregates) {
    const catalog: VerbCatalog = { deckId: `topic-${topic.slug}`, words: topic.words };
    const pageDir = `words/topics/${topic.slug}`;
    writeCatalog(pageDir, catalog);
    const index = syntheticIndexFromCatalog(
      topic.title,
      `Слова и фразы по теме «${topic.title}».`,
      catalog,
      `topics/${topic.slug}/readme.md`,
    );
    writeHtml(
      `${pageDir}/index.html`,
      renderIndex(
        index,
        pageDir,
        [
          { label: 'Главная', href: sitePath('index.html') },
          { label: 'Темы', href: sitePath('words/topics/index.html') },
          { label: topic.title },
        ],
        catalog,
      ),
    );
    console.log(`  🏷  words/topics/${topic.slug}/index.html (${topic.words.length})`);
  }

  writeHtml(
    'words/levels/index.html',
    renderTopicLevelHub(
      'Уровни CEFR',
      levelAggregates.map((l) => ({
        title: l.level,
        href: `words/levels/${l.level.toLowerCase()}/index.html`,
        count: l.words.length,
        description: `${l.words.length} записей · уровень ${l.level}`,
      })),
      breadcrumbsForIndex('levels/readme.md', 'Уровни'),
    ),
  );

  for (const levelAgg of levelAggregates) {
    const slug = levelAgg.level.toLowerCase();
    const catalog: VerbCatalog = { deckId: `level-${slug}`, words: levelAgg.words };
    const pageDir = `words/levels/${slug}`;
    writeCatalog(pageDir, catalog);
    const index = syntheticIndexFromCatalog(
      levelAgg.level,
      `Лексика уровня ${levelAgg.level}.`,
      catalog,
      `levels/${slug}/readme.md`,
    );
    writeHtml(
      `${pageDir}/index.html`,
      renderIndex(
        index,
        pageDir,
        [
          { label: 'Главная', href: sitePath('index.html') },
          { label: 'Уровни', href: sitePath('words/levels/index.html') },
          { label: levelAgg.level },
        ],
        catalog,
      ),
    );
    console.log(`  📊 words/levels/${slug}/index.html (${levelAgg.words.length})`);
  }
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
  const wordsBySlug = new Map<string, WordEntry>();

  const casesGamePath = path.join(SITE_DIR, 'data', 'cases-game.json');
  const casesGameData = fs.existsSync(casesGamePath)
    ? JSON.parse(fs.readFileSync(casesGamePath, 'utf-8'))
    : { items: [] };

  const indexPages: IndexPage[] = [];
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
            casesGameData,
          )
        : renderIndex(
            index,
            pageDir,
            breadcrumbsForIndex(relative, index.title),
            catalog.words.length > 0 ? catalog : undefined,
          );
    writeHtml(out, html);
    console.log(`  📄 ${out} (+ catalog ${catalog.words.length} words)`);
  }

  const globalWords: CatalogWord[] = words.map((word) => {
    const fileName = `${path.basename(word.sourcePath).replace(/\.md$/i, '')}.html`;
    return buildCatalogWord(word, `${word.category}/${fileName}`, word.translation || word.title);
  });

  renderTopicLevelPages(globalWords);

  const globalCatalog = buildGlobalCatalog(indexPages, words, wordsBySlug, wordsByHref);
  writeCatalog('', globalCatalog);

  const homeSections = [
    { title: 'Уроки', href: 'words/lessons/index.html', description: 'Слова по занятиям с репетитором' },
    { title: 'Глаголы', href: 'words/verbs/index.html', description: 'Спряжения, времена и формы' },
    { title: 'Существительные', href: 'words/nouns/index.html', description: 'Род, число и падежные формы' },
    { title: 'Прилагательные', href: 'words/adjectives/index.html', description: 'Согласование и степени сравнения' },
    { title: 'Местоимения', href: 'words/pronouns/index.html', description: 'Личные, притяжательные и указательные' },
    { title: 'Фразы', href: 'words/phrases/index.html', description: 'Устойчивые выражения и обороты' },
    { title: 'Числа', href: 'words/numbers/index.html', description: 'Количественные и порядковые' },
    { title: 'Падежи и управление', href: 'words/cases/index.html', description: 'Падежи, управление глаголов и практика' },
    { title: 'Частицы', href: 'words/particles/index.html', description: 'Связки для письма: и, но, поэтому, потом…' },
    { title: 'Темы', href: 'words/topics/index.html', description: 'Группировка по темам из метаданных' },
    { title: 'Уровни', href: 'words/levels/index.html', description: 'A1 → B2 по шкале CEFR' },
  ];

  writeHtml('index.html', renderHome(homeSections, globalCatalog));
  console.log('  🏠 index.html');

  const searchIndex = buildSearchIndex(globalWords);
  writeHtml('search.html', renderSearch(searchIndex));
  console.log(`  🔍 search.html (${searchIndex.length} words)`);

  console.log(`✅ Done — ${words.length} word(s), output: dist/`);
}

main();
