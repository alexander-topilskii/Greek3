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

const learningPath = ladder.buildLearningPath(verb);
if (learningPath.length < 2) throw new Error('Expected quiz and match in learning path');
if (learningPath[0] !== 'quiz' || learningPath[1] !== 'match') {
  throw new Error(`Expected quiz then match, got ${learningPath.join(',')}`);
}

if (!ladder.isLastLadderGame(2, learningPath)) {
  throw new Error('Step 2 should be last game for quiz+match path');
}
if (ladder.isLastLadderGame(1, learningPath)) {
  throw new Error('Step 1 should not be last game for quiz+match path');
}

if (ladder.shouldUseLadder({ direction: 'ru-el', repetitions: 0 }, { isMastered: () => false })) {
  throw new Error('ru-el should not use learning ladder');
}
if (!ladder.shouldUseLadder({ direction: 'el-ru', repetitions: 0 }, { isMastered: () => false })) {
  throw new Error('el-ru should use learning ladder while learning');
}

const pendingCard = { learningStep: 1, learningPath };
if (!ladder.hasPendingLearningGame(pendingCard)) {
  throw new Error('Expected pending learning game at step 1');
}
const doneCard = { learningStep: learningPath.length + 1, learningPath };
if (ladder.hasPendingLearningGame(doneCard)) {
  throw new Error('Should not have pending game after path complete');
}
if (ladder.hasPendingLearningGame({ learningStep: 0, learningPath })) {
  throw new Error('Summary step should not be pending');
}

const sleepVerb = {
  ...verb,
  forms: [
    { greek: 'κοιμήθηκα', translation: 'я спал' },
    { greek: 'κοιμήθηκα', translation: 'я спала' },
    { greek: 'κοιμήθηκες', translation: 'ты спал' },
    { greek: 'κοιμάμαι', translation: 'я сплю' },
    { greek: 'κοιμάσαι', translation: 'ты спишь' },
    { greek: 'θα κοιμηθώ', translation: 'я буду спать' },
    { greek: 'θα κοιμηθείς', translation: 'ты будешь спать' },
  ],
};
const sleepMatch = ladder.getMatchPairs(sleepVerb, 4);
const dupGreek = sleepMatch.filter((p) => p.greek === 'κοιμήθηκα');
if (dupGreek.length < 2) {
  throw new Error('Expected duplicate κοιμήθηκα pairs for gendered translations');
}
if (new Set(dupGreek.map((p) => p.translation)).size < 2) {
  throw new Error('Duplicate greek pairs should keep distinct translations');
}

console.log('✓ learning ladder base pairs');
console.log('✓ learning ladder match pairs');
console.log('✓ learning ladder quiz options');
console.log('✓ learning ladder fixed path order');
console.log('✓ learning ladder last game detection');
console.log('✓ learning ladder direction gate');
console.log('✓ learning ladder pending game detection');
console.log('✓ learning ladder duplicate greek pairs');
