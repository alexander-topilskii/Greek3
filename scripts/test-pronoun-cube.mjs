import fs from 'fs';
import path from 'path';
import { getParadigmForWordSlug, ALL_PRONOUN_PARADIGMS } from '../dist/build/pronoun-data.js';
import { renderPronounCube, renderPronounCubeHub } from '../dist/build/render/pronoun-cube.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. Paradigms and slug mapping
assert(ALL_PRONOUN_PARADIGMS.length >= 5, 'at least 5 paradigms defined');

const ego = getParadigmForWordSlug('pronouns/я εγώ');
assert(ego, 'ego found');
assert(ego.initialCase === 'nominative', 'ego nominative');
assert(ego.highlightForm === 'εγώ', 'ego highlight');

const me = getParadigmForWordSlug('pronouns/меня με');
assert(me, 'me found');
assert(me.initialCase === 'accusative', 'me accusative');
assert(me.initialVariant === 'weak', 'me weak clitic');
assert(me.highlightForm === 'με', 'me highlight');

const mou = getParadigmForWordSlug('pronouns/мой мне μου');
assert(mou, 'mou found');
assert(mou.initialCase === 'genitive', 'mou genitive');
assert(mou.highlightForm === 'μου', 'mou highlight');

const dikos = getParadigmForWordSlug('pronouns/мой свой δικός');
assert(dikos, 'dikos found');
assert(dikos.initialVariant === 'possessive', 'dikos possessive');

const autos = getParadigmForWordSlug('pronouns/этот эта это αυτός');
assert(autos, 'autos found');
assert(autos.paradigm.id === 'demonstrative_autos', 'autos paradigm id');

const ekeinos = getParadigmForWordSlug('pronouns/тот та то εκείνος');
assert(ekeinos, 'ekeinos found');
assert(ekeinos.paradigm.id === 'demonstrative_ekeinos', 'ekeinos paradigm id');

const poios = getParadigmForWordSlug('pronouns/кто какой ποιος');
assert(poios, 'poios found');
assert(poios.paradigm.id === 'interrogative_poios', 'poios paradigm id');

// 2. renderPronounCube for word
const mockWord = {
  slug: 'pronouns/меня με',
  category: 'pronouns',
  title: 'меня με',
  translation: 'меня',
  primaryGreek: 'με',
  baseForms: ['με'],
  forms: [{ greek: 'με', translation: 'меня' }],
  meta: {},
  extraSections: [],
};

const renderedWord = renderPronounCube(mockWord);
assert(renderedWord.interactive, 'renderedWord is interactive');
assert(renderedWord.html.includes('data-pronoun-cube'), 'has data-pronoun-cube attribute');
assert(renderedWord.html.includes('pronoun-cube-face--nominative'), 'has nominative face');
assert(renderedWord.html.includes('pronoun-cube-face--accusative'), 'has accusative face');
assert(renderedWord.html.includes('pronoun-cube-face--genitive'), 'has genitive face');
assert(renderedWord.html.includes('is-current'), 'has is-current highlight');
assert(renderedWord.html.includes('data-pronoun-data'), 'has data-pronoun-data json');

// 3. renderPronounCubeHub for list page
const hubHtml = renderPronounCubeHub();
assert(hubHtml.includes('pronoun-tabs'), 'hub has tabs');
assert(hubHtml.includes('data-paradigm="personal"'), 'hub has personal tab');
assert(hubHtml.includes('data-paradigm="demonstrative_autos"'), 'hub has autos tab');
assert(hubHtml.includes('data-paradigm="demonstrative_ekeinos"'), 'hub has ekeinos tab');
assert(hubHtml.includes('data-paradigm="demonstrative_tetoios"'), 'hub has tetoios tab');
assert(hubHtml.includes('data-paradigm="interrogative_poios"'), 'hub has poios tab');

// 4. Verify generated dist files
const distHub = path.join(process.cwd(), 'dist', 'words', 'pronouns', 'index.html');
if (fs.existsSync(distHub)) {
  const content = fs.readFileSync(distHub, 'utf-8');
  assert(content.includes('data-pronoun-cube'), 'dist pronouns/index.html has pronoun cube');
  assert(content.includes('assets/js/pronoun-cube.js'), 'dist pronouns/index.html includes pronoun-cube.js');
}

const distWord = path.join(process.cwd(), 'dist', 'words', 'pronouns', 'меня με.html');
if (fs.existsSync(distWord)) {
  const content = fs.readFileSync(distWord, 'utf-8');
  assert(content.includes('data-pronoun-cube'), 'dist words/pronouns/меня με.html has pronoun cube');
  assert(content.includes('assets/js/pronoun-cube.js'), 'dist words/pronouns/меня με.html includes pronoun-cube.js');
  assert(content.includes('is-current'), 'dist words/pronouns/меня με.html has highlighted active cell');
}

console.log('✓ pronoun cube ok');
