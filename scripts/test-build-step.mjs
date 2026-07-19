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
  baseForms: ['φεύγω', 'θα φύγω'],
  forms: [
    { greek: 'φεύγω', translation: 'я ухожу' },
    { greek: 'θα φύγω', translation: 'я уйду' },
  ],
  examples: [
    { greek: 'Αύριο θα φύγω νωρίς.', translation: 'Завтра я уйду рано.' },
    { greek: 'Φεύγω.', translation: 'Я ухожу.' }, // too short → skipped
    {
      greek: 'Δεν θέλω να πάω εκεί σήμερα με αυτούς τους ανθρώπους τώρα.',
      translation: 'слишком длинно',
    }, // too long → skipped
  ],
};

const items = ladder.getSentenceBuildItems(verb);
if (items.length !== 1) {
  throw new Error(`Expected 1 build item (short & long skipped), got ${items.length}`);
}

const item = items[0];
// Trailing period stripped; tokens preserved in order.
if (item.tokens.join(' ') !== 'Αύριο θα φύγω νωρίς') {
  throw new Error(`Unexpected tokens: ${item.tokens.join(' ')}`);
}
if (item.tokens.length !== 4) {
  throw new Error(`Expected 4 tokens, got ${item.tokens.length}`);
}
if (item.sentence !== 'Αύριο θα φύγω νωρίς.') {
  throw new Error(`Expected original sentence preserved, got "${item.sentence}"`);
}

// No examples → no items and BUILD absent from path.
if (ladder.getSentenceBuildItems({ ...verb, examples: [] }).length !== 0) {
  throw new Error('Expected no build items without examples');
}

// Options: all answer tokens present + exactly 2 decoys, no key-collisions.
const pool = [
  verb,
  { slug: 'a', translation: 'ем', baseForms: ['τρώω'], forms: [] },
  { slug: 'b', translation: 'пью', baseForms: ['πίνω'], forms: [] },
  { slug: 'c', translation: 'сплю', baseForms: ['κοιμάμαι'], forms: [] },
];
const { bank, decoys } = ladder.buildSentenceOptions(pool, verb, item.tokens);

if (decoys.length !== 2) {
  throw new Error(`Expected 2 decoys, got ${decoys.length}`);
}
if (bank.length !== item.tokens.length + 2) {
  throw new Error(`Expected bank of ${item.tokens.length + 2}, got ${bank.length}`);
}

// Every answer token must be reconstructable from the bank in order.
const bankTexts = bank.map((b) => b.text);
for (const tok of item.tokens) {
  if (!bankTexts.includes(tok)) {
    throw new Error(`Bank missing answer token "${tok}"`);
  }
}

// Decoys must not duplicate any answer word (case/punctuation-insensitive).
const answerKeys = new Set(
  item.tokens.map((t) => t.normalize('NFC').toLocaleLowerCase('el').replace(/[.,;!·]/g, '')),
);
for (const d of decoys) {
  const key = d.normalize('NFC').toLocaleLowerCase('el').replace(/[.,;!·]/g, '');
  if (answerKeys.has(key)) {
    throw new Error(`Decoy "${d}" collides with an answer token`);
  }
  if (d.includes(' ')) {
    throw new Error(`Decoy "${d}" must be a single word`);
  }
}

// Small pool falls back to builtin decoys.
const { decoys: fallbackDecoys } = ladder.buildSentenceOptions([verb], verb, item.tokens);
if (fallbackDecoys.length !== 2) {
  throw new Error(`Expected 2 fallback decoys, got ${fallbackDecoys.length}`);
}

// BUILD appended as the final step when examples support it.
const learningPath = ladder.buildLearningPath(verb, { spellEligible: true });
if (learningPath[learningPath.length - 1] !== 'build') {
  throw new Error(`Expected build as last step, got ${learningPath.join(',')}`);
}
if (ladder.buildLearningPath({ ...verb, examples: [] }).includes('build')) {
  throw new Error('Build should be absent without usable examples');
}

console.log('✓ build items from context examples (length bounds)');
console.log('✓ build tokens strip trailing punctuation, keep order');
console.log('✓ build skips words without examples');
console.log('✓ build options add exactly 2 non-colliding decoys');
console.log('✓ build falls back to builtin decoys for small pools');
console.log('✓ build appended to learning path');
