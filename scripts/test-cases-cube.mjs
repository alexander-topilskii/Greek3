import fs from 'fs';
import path from 'path';
import {
  getParadigmForCaseWordSlug,
  ALL_CASE_PARADIGMS,
  NOUNS_CASE_PARADIGM,
  VERB_GOVERNMENT_PARADIGM,
} from '../dist/build/cases-data.js';
import { renderCasesCube, renderCasesCubeHub } from '../dist/build/render/cases-cube.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. Paradigms
assert(ALL_CASE_PARADIGMS.length === 4, '4 case paradigms defined');

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

// 2. renderCasesCube for word
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
assert(renderedWord.html.includes('data-cases-data'), 'has data-cases-data json');

// 3. renderCasesCubeHub for cases index
const hubHtml = renderCasesCubeHub();
assert(hubHtml.includes('cases-tabs'), 'hub has cases tabs');
assert(hubHtml.includes('data-paradigm="nouns"'), 'hub has nouns tab');
assert(hubHtml.includes('data-paradigm="adjectives"'), 'hub has adjectives tab');
assert(hubHtml.includes('data-paradigm="articles"'), 'hub has articles tab');
assert(hubHtml.includes('data-paradigm="government"'), 'hub has government tab');

// 4. Verify generated dist files
const distHub = path.join(process.cwd(), 'dist', 'words', 'cases', 'index.html');
if (fs.existsSync(distHub)) {
  const content = fs.readFileSync(distHub, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/index.html has cases cube');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/index.html includes cases-cube.js');
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
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/винительный αιτιατική.html includes cases-cube.js');
}

const distGen = path.join(process.cwd(), 'dist', 'words', 'cases', 'родительный γενική.html');
if (fs.existsSync(distGen)) {
  const content = fs.readFileSync(distGen, 'utf-8');
  assert(content.includes('data-cases-cube'), 'dist cases/родительный γενική.html has cases cube');
  assert(content.includes('assets/js/cases-cube.js'), 'dist cases/родительный γενική.html includes cases-cube.js');
}

console.log('✓ cases cube ok');
