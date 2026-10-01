import fs from 'fs';
import path from 'path';
import {
  getParadigmForAdverbWordSlug,
  getAdverbThemeInfo,
  ALL_ADVERB_PARADIGMS,
  ALL_ADVERB_THEMES,
  PLACE_ADVERB_PARADIGM,
  TIME_ADVERB_PARADIGM,
  MANNER_ADVERB_PARADIGM,
  DEGREE_ADVERB_PARADIGM,
  CORRELATIVE_ADVERB_PARADIGM,
} from '../dist/build/adverbs-data.js';
import {
  renderAdverbCube,
  renderAdverbsCubeHub,
  renderAdverbThemeCube,
  renderAdverbsThemesHub,
} from '../dist/build/render/adverbs-cube.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. Paradigms & Themes
assert(ALL_ADVERB_PARADIGMS.length === 5, '5 adverb paradigms defined');
assert(ALL_ADVERB_THEMES.length === 7, '7 adverb themes defined');

// Place lookup
const placeWord = getParadigmForAdverbWordSlug('adverbs/здесь εδώ');
assert(placeWord, 'place word found');
assert(placeWord.paradigm.id === 'place', 'place paradigm is place');
assert(placeWord.initialPosition === 'left', 'place initialPosition is left');

const placeTheme = getAdverbThemeInfo('adverbs/здесь εδώ');
assert(placeTheme && placeTheme.id === 'place', 'place theme matched');

// Time lookup
const timeWord = getParadigmForAdverbWordSlug('adverbs/сегодня σήμερα');
assert(timeWord, 'time word found');
assert(timeWord.paradigm.id === 'time', 'time paradigm is time');
assert(timeWord.initialPosition === 'center', 'time initialPosition is center');

const timeTheme = getAdverbThemeInfo('adverbs/сегодня σήμερα');
assert(timeTheme && timeTheme.id === 'time', 'time theme matched');

// Manner lookup
const mannerWord = getParadigmForAdverbWordSlug('adverbs/хорошо καλά');
assert(mannerWord, 'manner word found');
assert(mannerWord.paradigm.id === 'manner', 'manner paradigm is manner');

// Degree lookup
const degreeWord = getParadigmForAdverbWordSlug('adverbs/очень сильно πάρα πολύ');
assert(degreeWord, 'degree word found');
assert(degreeWord.paradigm.id === 'degree', 'degree paradigm is degree');

// Correlatives lookup
const questionWord = getParadigmForAdverbWordSlug('adverbs/где πού');
assert(questionWord, 'question word found');
assert(questionWord.paradigm.id === 'correlatives', 'question paradigm is correlatives');

// Modal and languages themes
const modalTheme = getAdverbThemeInfo('adverbs/конечно σίγουρα');
assert(modalTheme && modalTheme.id === 'modal', 'modal theme matched');

const langTheme = getAdverbThemeInfo('adverbs/по-гречески ελληνικά');
assert(langTheme && langTheme.id === 'languages', 'languages theme matched');

// 2. renderAdverbCube for word
const mockWord = {
  slug: 'adverbs/здесь εδώ',
  category: 'adverbs',
  title: 'здесь εδώ',
  translation: 'здесь',
  primaryGreek: 'εδώ',
  baseForms: ['εδώ'],
  forms: [{ greek: 'εδώ', translation: 'здесь' }],
  meta: {},
  extraSections: [],
};

const renderedWord = renderAdverbCube(mockWord);
assert(renderedWord.interactive, 'renderedWord is interactive');
assert(renderedWord.html.includes('data-adverbs-cube'), 'has data-adverbs-cube');
assert(renderedWord.html.includes('adverbs-cube-face--left'), 'has left face');
assert(renderedWord.html.includes('adverbs-cube-face--center'), 'has center face');
assert(renderedWord.html.includes('adverbs-cube-face--right'), 'has right face');
assert(renderedWord.html.includes('data-adverbs-data'), 'has data-adverbs-data json');
assert(renderedWord.html.includes('adverbs-theme-back-link'), 'has theme back link');

// 3. renderAdverbThemeCube & renderAdverbsThemesHub
const themeCubeHtml = renderAdverbThemeCube(PLACE_ADVERB_PARADIGM);
assert(themeCubeHtml.includes('data-adverbs-cube'), 'theme cube has data-adverbs-cube');
assert(!themeCubeHtml.includes('adverbs-tabs'), 'theme cube does not have multi-category tabs');

const themesHubHtml = renderAdverbsThemesHub();
assert(themesHubHtml.includes('adverbs-themes-grid'), 'hub has themes grid');
assert(themesHubHtml.includes('words/adverbs/place/index.html'), 'hub links to place category');
assert(themesHubHtml.includes('words/adverbs/time/index.html'), 'hub links to time category');
assert(themesHubHtml.includes('words/adverbs/questions/index.html'), 'hub links to questions category');

// 4. Verify generated dist files if built
const distHub = path.join(process.cwd(), 'dist', 'words', 'adverbs', 'index.html');
if (fs.existsSync(distHub)) {
  const content = fs.readFileSync(distHub, 'utf-8');
  assert(content.includes('adverbs-themes-grid'), 'dist adverbs/index.html has themes grid');
  assert(content.includes('words/adverbs/place/index.html'), 'dist adverbs/index.html links to place');
}

const distPlace = path.join(process.cwd(), 'dist', 'words', 'adverbs', 'place', 'index.html');
if (fs.existsSync(distPlace)) {
  const content = fs.readFileSync(distPlace, 'utf-8');
  assert(content.includes('data-adverbs-cube'), 'dist place/index.html has adverbs cube');
  assert(content.includes('adverbs-category-page'), 'dist place/index.html is category page');
}

const distTime = path.join(process.cwd(), 'dist', 'words', 'adverbs', 'time', 'index.html');
if (fs.existsSync(distTime)) {
  const content = fs.readFileSync(distTime, 'utf-8');
  assert(content.includes('data-adverbs-cube'), 'dist time/index.html has adverbs cube');
}

console.log('✓ adverbs cube ok');
