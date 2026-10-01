import fs from 'fs';
import path from 'path';
import {
  getParadigmForCaseWordSlug,
  getParadigmForCaseSubDir,
  getCaseThemeInfo,
  ALL_CASE_PARADIGMS,
  ALL_CASE_THEMES,
  NOUNS_CASE_PARADIGM,
  VERB_GOVERNMENT_PARADIGM,
} from '../dist/build/cases-data.js';
import {
  renderCasesCube,
  renderCasesCubeHub,
  renderCaseThemeCube,
  renderCasesThemesHub,
} from '../dist/build/render/cases-cube.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. Paradigms & Themes
assert(ALL_CASE_PARADIGMS.length === 4, '4 case paradigms defined');
assert(ALL_CASE_THEMES.length === 4, '4 case themes defined');

const nounsTheme = getParadigmForCaseSubDir('nouns');
assert(nounsTheme && nounsTheme.id === 'nouns', 'nouns theme paradigm found');

const adjTheme = getParadigmForCaseSubDir('adjectives');
assert(adjTheme && adjTheme.id === 'adjectives', 'adjectives theme paradigm found');

const artTheme = getParadigmForCaseSubDir('articles');
assert(artTheme && artTheme.id === 'articles', 'articles theme paradigm found');

const govTheme = getParadigmForCaseSubDir('government');
assert(govTheme && govTheme.id === 'government', 'government theme paradigm found');

const nom = getParadigmForCaseWordSlug('cases/именительный ονομαστική');
assert(nom, 'nom found');
assert(nom.initialCase === 'nominative', 'nom case is nominative');
assert(nom.paradigm.id === 'nouns', 'nom paradigm is nouns');

const acc = getParadigmForCaseWordSlug('cases/винительный αιτιατική');
assert(acc, 'acc found');
assert(acc.initialCase === 'accusative', 'acc case is accusative');
assert(acc.paradigm.id === 'nouns', 'acc paradigm is nouns');

const gen = getParadigmForCaseWordSlug('cases/родительный γενική');
assert(gen, 'gen found');
assert(gen.initialCase === 'genitive', 'gen case is genitive');
assert(gen.paradigm.id === 'nouns', 'gen paradigm is nouns');

const gov = getParadigmForCaseWordSlug('cases/управление глаголов verb government');
assert(gov, 'gov found');
assert(gov.paradigm.id === 'government', 'gov paradigm is government');

// 2. renderCasesCube for word (with theme backlink and transformations)
const mockWord = {
  slug: 'cases/винительный αιτιατική',
  category: 'cases',
  title: 'винительный αιτιατική',
  translation: 'винительный падеж',
  primaryGreek: 'αιτιατική',
  baseForms: ['αιτιατική'],
  forms: [{ greek: 'αιτιατική', translation: 'винительный падеж' }],
  meta: {},
  extraSections: [],
};

const renderedWord = renderCasesCube(mockWord);
assert(renderedWord.interactive, 'renderedWord is interactive');
assert(renderedWord.html.includes('data-cases-cube'), 'has data-cases-cube');
assert(renderedWord.html.includes('cases-cube-face--nominative'), 'has nominative face');
assert(renderedWord.html.includes('cases-cube-face--accusative'), 'has accusative face');
assert(renderedWord.html.includes('cases-cube-face--genitive'), 'has genitive face');
assert(renderedWord.html.includes('cases-item-trans'), 'has transformation markup');
assert(renderedWord.html.includes('cases-trans-from'), 'has from form');
assert(renderedWord.html.includes('cases-trans-to'), 'has to form');
assert(renderedWord.html.includes('cases-theme-back-link'), 'has theme back link');
assert(renderedWord.html.includes('data-cases-data'), 'has data-cases-data json');

// 3. renderCaseThemeCube & renderCasesThemesHub
const themeCubeHtml = renderCaseThemeCube(nounsTheme);
assert(themeCubeHtml.includes('data-cases-cube'), 'theme cube has data-cases-cube');
assert(themeCubeHtml.includes('cases-item-trans'), 'theme cube has transformation markup');

const themesHubHtml = renderCasesThemesHub();
assert(themesHubHtml.includes('cases-themes-hub'), 'hub has cases-themes-hub');
assert(themesHubHtml.includes('words/cases/nouns/index.html'), 'hub links to nouns');
assert(themesHubHtml.includes('words/cases/adjectives/index.html'), 'hub links to adjectives');
assert(themesHubHtml.includes('words/cases/articles/index.html'), 'hub links to articles');
assert(themesHubHtml.includes('words/cases/government/index.html'), 'hub links to government');

// 4. Verify generated dist files
const distHub = path.join(process.cwd(), 'dist', 'words', 'cases', 'index.html');
if (fs.existsSync(distHub)) {
  const content = fs.readFileSync(distHub, 'utf-8');
  assert(content.includes('cases-themes-hub'), 'dist cases/index.html has themes hub');
  assert(content.includes('cases-cheatsheet'), 'dist cases/index.html has cheatsheet');
  assert(content.includes('cases-practice-launch-btn'), 'dist cases/index.html has practice button');
}

const distNouns = path.join(process.cwd(), 'dist', 'words', 'cases', 'nouns', 'index.html');
if (fs.existsSync(distNouns)) {
  const content = fs.readFileSync(distNouns, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/nouns/index.html has cases cube');
  assert(content.includes('cases-item-trans'), 'dist cases/nouns/index.html has transformation markup');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/nouns/index.html includes cases-cube.js');
}

const distAdj = path.join(process.cwd(), 'dist', 'words', 'cases', 'adjectives', 'index.html');
if (fs.existsSync(distAdj)) {
  const content = fs.readFileSync(distAdj, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/adjectives/index.html has cases cube');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/adjectives/index.html includes cases-cube.js');
}

const distArt = path.join(process.cwd(), 'dist', 'words', 'cases', 'articles', 'index.html');
if (fs.existsSync(distArt)) {
  const content = fs.readFileSync(distArt, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/articles/index.html has cases cube');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/articles/index.html includes cases-cube.js');
}

const distGov = path.join(process.cwd(), 'dist', 'words', 'cases', 'government', 'index.html');
if (fs.existsSync(distGov)) {
  const content = fs.readFileSync(distGov, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/government/index.html has cases cube');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/government/index.html includes cases-cube.js');
}

const distNom = path.join(process.cwd(), 'dist', 'words', 'cases', 'именительный ονομαστική.html');
if (fs.existsSync(distNom)) {
  const content = fs.readFileSync(distNom, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/именительный ονομαστική.html has cases cube');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/именительный ονομαστική.html includes cases-cube.js');
}

const distAcc = path.join(process.cwd(), 'dist', 'words', 'cases', 'винительный αιτιατική.html');
if (fs.existsSync(distAcc)) {
  const content = fs.readFileSync(distAcc, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/винительный αιτιατική.html has cases cube');
  assert(content.includes('cases-item-trans'), 'dist cases/винительный αιτιατική.html has transformations');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/винительный αιτιατική.html includes cases-cube.js');
}

const distGen = path.join(process.cwd(), 'dist', 'words', 'cases', 'родительный γενική.html');
if (fs.existsSync(distGen)) {
  const content = fs.readFileSync(distGen, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/родительный γενική.html has cases cube');
  assert(content.includes('cases-item-trans'), 'dist cases/родительный γενική.html has transformations');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/родительный γενική.html includes cases-cube.js');
}

console.log('✓ cases cube & themes ok');
