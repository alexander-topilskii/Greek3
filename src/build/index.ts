import fs from 'fs';
import path from 'path';
import {
  buildSlugIndexMap,
  indexOutputPath,
  inferredTopicsForSlug,
  parseIndexFile,
} from './parse-index';
import { isWordFile, parseWordFile } from './parse-word';
import {
  buildLevelAggregates,
  buildTopicAggregates,
  enrichWordEntry,
} from './meta';
import {
  buildCatalogWord,
  outputDirFor,
  renderCasesIndex,
  renderHome,
  renderIndex,
  renderTopicLevelHub,
  renderWord,
  sitePath,
  syntheticIndexFromCatalog,
  wordOutputPath,
} from './render';
import type { CatalogWord, HomeSection, IndexLink, IndexPage, VerbCatalog, WordEntry } from './types';

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
  cases: 'Падежи',
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
    if (relativePath.toLowerCase() !== 'topics/readme.md') {
      crumbs.push({ label: title });
    } else {
      crumbs[crumbs.length - 1] = { label: title };
    }
    return crumbs;
  }

  if (category === 'levels') {
    crumbs.push({ label: 'Уровни', href: sitePath('words/levels/index.html') });
    if (relativePath.toLowerCase() !== 'levels/readme.md') {
      crumbs.push({ label: title });
    } else {
      crumbs[crumbs.length - 1] = { label: title };
    }
    return crumbs;
  }

  if (category && CATEGORY_LABELS[category]) {
    crumbs.push({ label: 'Словарь', href: sitePath('words/index.html') });
  }
  crumbs.push({ label: title });
  return crumbs;
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
  const rawWords: WordEntry[] = [];
  const wordsBySlug = new Map<string, WordEntry>();
  const wordsByHref = new Map<string, WordEntry>();

  const casesGamePath = path.join(SITE_DIR, 'data', 'cases-game.json');
  const casesGameData = fs.existsSync(casesGamePath)
    ? JSON.parse(fs.readFileSync(casesGamePath, 'utf-8'))
    : { items: [] };

  // Pass 1: parse index files for topic inference
  const indexPages: IndexPage[] = [];
  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);
    if (!relative.toLowerCase().endsWith('readme.md')) continue;
    indexPages.push(parseIndexFile(file, WORDS_DIR));
  }
  const slugIndexMap = buildSlugIndexMap(indexPages);

  // Pass 2: parse and enrich words
  for (const file of mdFiles) {
    const relative = path.relative(WORDS_DIR, file);
    if (relative.toLowerCase() === 'readme.md') continue;
    if (relative.toLowerCase().endsWith('readme.md')) continue;

    if (isWordFile(relative)) {
      const parsed = parseWordFile(file, WORDS_DIR);
      const inferredTopics = inferredTopicsForSlug(slugIndexMap, parsed.slug);
      const word = enrichWordEntry(parsed, inferredTopics);
      rawWords.push(word);
      wordsBySlug.set(word.slug, word);
      const href = `${path.basename(file).replace(/\.md$/i, '')}.html`;
      wordsByHref.set(href, word);
    }
  }

  // Pass 3: render word pages
  for (const word of rawWords) {
    const out = wordOutputPath(word.slug);
    const html = renderWord(word, breadcrumbsForWord(word));
    writeHtml(out, html);
    console.log(`  📘 ${out}`);
  }

  // Pass 4: render index pages from readme
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

  // Pass 5: auto-generate topic and level pages
  const globalWords: CatalogWord[] = rawWords.map((word) => {
    const fileName = `${path.basename(word.sourcePath).replace(/\.md$/i, '')}.html`;
    const href = `${word.category}/${fileName}`;
    const label = word.primaryGreek
      ? `${word.primaryGreek} — ${word.translation || word.title}`
      : word.translation || word.title;
    return buildCatalogWord(word, href, label);
  });

  const topicAggregates = buildTopicAggregates(globalWords);
  const levelAggregates = buildLevelAggregates(globalWords);

  writeJson('assets/data/global-catalog.json', { deckId: 'global', words: globalWords });

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
    const catalog: VerbCatalog = {
      deckId: `topic-${topic.slug}`,
      words: topic.words,
    };
    const pageDir = `words/topics/${topic.slug}`;
    writeCatalog(pageDir, catalog);
    const index = syntheticIndexFromCatalog(
      topic.title,
      `Слова и фразы по теме «${topic.title}».`,
      catalog,
      `topics/${topic.slug}/readme.md`,
      'topics',
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
    const catalog: VerbCatalog = {
      deckId: `level-${slug}`,
      words: levelAgg.words,
    };
    const pageDir = `words/levels/${slug}`;
    writeCatalog(pageDir, catalog);
    const index = syntheticIndexFromCatalog(
      levelAgg.level,
      `Лексика уровня ${levelAgg.level}.`,
      catalog,
      `levels/${slug}/readme.md`,
      'levels',
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

  const homeSections: HomeSection[] = [
    {
      title: 'Уроки',
      href: 'words/lessons/index.html',
      description: 'Слова по занятиям с репетитором',
      group: 'primary',
    },
    {
      title: 'Глаголы',
      href: 'words/verbs/index.html',
      description: 'Спряжения, времена и формы',
      group: 'primary',
    },
    {
      title: 'Существительные',
      href: 'words/nouns/index.html',
      description: 'Род, число и падежные формы',
      group: 'primary',
    },
    {
      title: 'Прилагательные',
      href: 'words/adjectives/index.html',
      description: 'Согласование и степени сравнения',
      group: 'primary',
    },
    {
      title: 'Местоимения',
      href: 'words/pronouns/index.html',
      description: 'Личные, притяжательные и указательные',
      group: 'primary',
    },
    {
      title: 'Фразы',
      href: 'words/phrases/index.html',
      description: 'Устойчивые выражения и обороты',
      group: 'primary',
    },
    {
      title: 'Числа',
      href: 'words/numbers/index.html',
      description: 'Количественные и порядковые',
      group: 'primary',
    },
    {
      title: 'Падежи',
      href: 'words/cases/index.html',
      description: 'Падежи и их употребление',
      group: 'primary',
    },
    {
      title: 'Частицы',
      href: 'words/particles/index.html',
      description: 'Связки для письма: и, но, поэтому, потом…',
      group: 'primary',
    },
    {
      title: 'Темы',
      href: 'words/topics/index.html',
      description: 'Группировка по темам: еда, дом, путешествия…',
      group: 'secondary',
    },
    {
      title: 'Уровни',
      href: 'words/levels/index.html',
      description: 'A1 → B2 по шкале CEFR',
      group: 'secondary',
    },
  ];

  writeHtml('index.html', renderHome(homeSections));
  console.log('  🏠 index.html');
  console.log(`✅ Done — ${rawWords.length} word(s), ${topicAggregates.length} topics, output: dist/`);
}

main();
