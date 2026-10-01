import fs from 'fs';
import path from 'path';
import {
  getParadigmForAdverbWordSlug,
  ALL_ADVERB_PARADIGMS,
  PLACE_ADVERB_PARADIGM,
  TIME_ADVERB_PARADIGM,
  MANNER_ADVERB_PARADIGM,
  DEGREE_ADVERB_PARADIGM,
  CORRELATIVE_ADVERB_PARADIGM,
} from '../dist/build/adverbs-data.js';
import { renderAdverbCube, renderAdverbsCubeHub } from '../dist/build/render/adverbs-cube.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. Paradigms
assert(ALL_ADVERB_PARADIGMS.length === 5, '5 adverb paradigms defined');

// Place lookup
const placeWord = getParadigmForAdverbWordSlug('adverbs/здесь εδώ');
assert(placeWord, 'place word found');
assert(placeWord.paradigm.id === 'place', 'place paradigm is place');
assert(placeWord.initialPosition === 'left', 'place initialPosition is left');

// Time lookup
const timeWord = getParadigmForAdverbWordSlug('adverbs/сегодня σήμερα');
assert(timeWord, 'time word found');
assert(timeWord.paradigm.id === 'time', 'time paradigm is time');
assert(timeWord.initialPosition === 'center', 'time initialPosition is center');

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

// 3. renderAdverbsCubeHub for adverbs index
const hubHtml = renderAdverbsCubeHub();
assert(hubHtml.includes('adverbs-tabs'), 'hub has adverbs tabs');
assert(hubHtml.includes('data-paradigm="place"'), 'hub has place tab');
assert(hubHtml.includes('data-paradigm="time"'), 'hub has time tab');
assert(hubHtml.includes('data-paradigm="manner"'), 'hub has manner tab');
assert(hubHtml.includes('data-paradigm="degree"'), 'hub has degree tab');
assert(hubHtml.includes('data-paradigm="correlatives"'), 'hub has correlatives tab');

// 4. Verify generated dist files if built
const distHub = path.join(process.cwd(), 'dist', 'words', 'adverbs', 'index.html');
if (fs.existsSync(distHub)) {
  const content = fs.readFileSync(distHub, 'utf-8');
  assert(content.includes('data-adverbs-cube'), 'dist adverbs/index.html has adverbs cube');
  assert(content.includes('assets/js/adverbs-cube.js'), 'dist adverbs/index.html includes adverbs-cube.js');
}

console.log('✓ adverbs cube ok');
