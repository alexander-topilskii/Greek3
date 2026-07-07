import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

global.window = global;
const code = fs.readFileSync(path.join(root, 'site/js/learning-ladder.js'), 'utf8');
vm.runInThisContext(code);
const ladder = global.GreekLearningLadder;

const verb = {
  slug: 'verbs/test',
  translation: 'сплю',
  baseForms: ['κοιμήθηκα', 'κοιμάμαι', 'θα κοιμηθώ'],
  forms: [
    { greek: 'κοιμήθηκα', translation: 'я спал' },
    { greek: 'κοιμήθηκες', translation: 'ты спал' },
    { greek: 'κοιμάμαι', translation: 'я сплю' },
    { greek: 'κοιμάσαι', translation: 'ты спишь' },
    { greek: 'θα κοιμηθώ', translation: 'я буду спать' },
    { greek: 'θα κοιμηθείς', translation: 'ты будешь спать' },
  ],
};

const base = ladder.getBaseFormPairs(verb);
if (base.length !== 3) throw new Error(`Expected 3 base pairs, got ${base.length}`);
if (base[1].translation !== 'я сплю') throw new Error('Base pair translation mismatch');

const match = ladder.getMatchPairs(verb, 4);
if (match.length < 3) throw new Error(`Expected at least 3 match pairs, got ${match.length}`);

const options = ladder.buildQuizOptions(
  [
    verb,
    { slug: 'a', translation: 'бегу', baseForms: ['έτρεξα'], forms: [] },
    { slug: 'b', translation: 'ем', baseForms: ['έφαγα'], forms: [] },
    { slug: 'c', translation: 'пью', baseForms: ['ήπια'], forms: [] },
  ],
  verb,
  base[0],
  'el-ru',
);
if (options.length !== 4) throw new Error(`Expected 4 quiz options, got ${options.length}`);
if (!options.includes('я спал')) throw new Error('Correct answer missing from options');

console.log('✓ learning ladder base pairs');
console.log('✓ learning ladder match pairs');
console.log('✓ learning ladder quiz options');
