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
  slug: 'verbs/leave',
  translation: 'ухожу',
  baseForms: ['έφυγα', 'φεύγω', 'θα φύγω'],
  forms: [
    { greek: 'έφυγα', translation: 'я ушёл' },
    { greek: 'φεύγω', translation: 'я ухожу' },
    { greek: 'φεύγεις', translation: 'ты уходишь' },
    { greek: 'θα φύγω', translation: 'я уйду' },
  ],
  examples: [
    { greek: 'Αύριο θα φύγω νωρίς.', translation: 'Завтра я уйду рано.' },
    { greek: 'Φεύγω κάθε πρωί στις οκτώ.', translation: 'Я ухожу каждое утро в восемь.' },
    { greek: 'Δεν υπάρχει τίποτα εδώ.', translation: 'Здесь ничего нет.' },
  ],
};

const items = ladder.getClozeItems(verb);
if (items.length !== 2) {
  throw new Error(`Expected 2 cloze items (third has no form), got ${items.length}`);
}

// Longest form wins: "θα φύγω" not "φύγω"/"φεύγω".
const first = items[0];
if (first.answer !== 'θα φύγω') {
  throw new Error(`Expected answer "θα φύγω", got "${first.answer}"`);
}
if (first.before !== 'Αύριο ' || first.after !== ' νωρίς.') {
  throw new Error(`Blank split wrong: [${first.before}] [${first.after}]`);
}

// Case-insensitive match keeps the sentence's original capitalization.
const second = items[1];
if (second.answer !== 'Φεύγω') {
  throw new Error(`Expected capitalized answer "Φεύγω", got "${second.answer}"`);
}
if (second.before !== '') {
  throw new Error(`Expected empty before for sentence-initial word, got "${second.before}"`);
}

// A word with no examples yields no cloze items.
const noExamples = ladder.getClozeItems({ ...verb, examples: [] });
if (noExamples.length !== 0) {
  throw new Error('Expected no cloze items without examples');
}

// Options include the answer and are unique.
const options = ladder.buildClozeOptions(
  [
    verb,
    { slug: 'a', translation: 'бегу', baseForms: ['τρέχω'], forms: [] },
    { slug: 'b', translation: 'ем', baseForms: ['τρώω'], forms: [] },
    { slug: 'c', translation: 'пью', baseForms: ['πίνω'], forms: [] },
  ],
  verb,
  first.answer,
);
if (!options.includes(first.answer)) {
  throw new Error('Cloze options must include the correct answer');
}
if (new Set(options).size !== options.length) {
  throw new Error('Cloze options must be unique');
}
if (options.length !== 4) {
  throw new Error(`Expected 4 cloze options, got ${options.length}`);
}

// Cloze is appended to the learning path when examples support it.
const pathFull = ladder.buildLearningPath(verb, { spellEligible: true });
if (pathFull[pathFull.length - 1] !== 'cloze') {
  throw new Error(`Expected cloze as last step, got ${pathFull.join(',')}`);
}

const pathNoCloze = ladder.buildLearningPath({ ...verb, examples: [] });
if (pathNoCloze.includes('cloze')) {
  throw new Error('Cloze should be absent without usable examples');
}

console.log('✓ cloze items from context examples');
console.log('✓ cloze longest-form and capitalization handling');
console.log('✓ cloze skips words without examples');
console.log('✓ cloze options include unique answer');
console.log('✓ cloze appended to learning path');
