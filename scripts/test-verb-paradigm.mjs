/**
 * Parser for verb tense / aspect / imperative / participle sections.
 * Run: npm run build && node scripts/test-verb-paradigm.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseVerbParadigm } from '../dist/build/parse-paradigm.js';
import { parseWordFile } from '../dist/build/parse-word.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const paradigm = parseVerbParadigm({
  conjugation: `
## настоящее
### разовое
γίνομαι | γινόμαστε
γίνεσαι | γίνεστε
γίνεται | γίνονται

### Завершённое
έχω γίνει | έχουμε γίνει
έχεις γίνει | έχετε γίνει
έχει γίνει | έχουν γίνει

## прошедшее / длительное
я: γινόμουν
ты: γινόσουν
он: γινόταν
мы: γινόμασταν
вы: γινόσασταν
они: γίνονταν
`.trim().split('\n'),
  imperative: ['γίνε | γίνετε'],
  participle: ['медиопассивное: γινόμενος, -η, -ο'],
});

assert(paradigm, 'paradigm parsed');
assert(paradigm.conjugations.present.simple[0] === 'γίνομαι', 'present 1s');
assert(paradigm.conjugations.present.simple[1] === 'γινόμαστε', 'present 1p');
assert(paradigm.conjugations.present.simple[5] === 'γίνονται', 'present 3p');
assert(paradigm.conjugations.present.perfect[0] === 'έχω γίνει', 'perfect 1s');
assert(!paradigm.conjugations.present.continuous, 'continuous omitted when empty');
assert(paradigm.conjugations.past.continuous[2] === 'γινόσουν', 'labeled 2s');
assert(paradigm.imperative.length === 1, 'one imperative');
assert(paradigm.imperative[0].aspect === 'default', 'imperative aspect');
assert(paradigm.imperative[0].sg === 'γίνε' && paradigm.imperative[0].pl === 'γίνετε', 'imperative forms');
assert(paradigm.participles[0].label === 'медиопассивное', 'participle label');
assert(paradigm.participles[0].form === 'γινόμενος, -η, -ο', 'participle form');

const split = parseVerbParadigm({
  imperative: ['## разовое', 'ед.: γίνε', 'мн.: γίνετε', '## длительное', 'γίνου | γίνεστε'],
});
assert(split.imperative.length === 2, 'two imperative aspects');
assert(split.imperative[0].aspect === 'simple' && split.imperative[0].sg === 'γίνε', 'aorist imperative');
assert(split.imperative[1].aspect === 'continuous' && split.imperative[1].pl === 'γίνεστε', 'present imperative');
assert(Object.keys(split.conjugations).length === 0, 'no conjugations');

assert(parseVerbParadigm({}) === null, 'empty is null');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'greek3-verb-'));
const words = path.join(dir, 'words');
fs.mkdirSync(path.join(words, 'verbs'), { recursive: true });
const file = path.join(words, 'verbs', 'становлюсь γίνομαι.md');
fs.writeFileSync(
  file,
  `# База
становлюсь : έγινα - γίνομαι - θα γίνω

# Спряжение
## будущее
### разовое
θα γίνω | θα γίνουμε
θα γίνεις | θα γίνετε
θα γίνει | θα γίνουν

# Повелительное
γίνε | γίνετε

# Контекст
- **Γίνομαι γιατρός.** — Я становлюсь врачом.

# Примеры к формам
- θα γίνω: **Θα γίνω καλύτερος άνθρωπος.** — Я стану лучшим человеком.
- θα γίνεις: **Θα γίνεις σπουδαίος επιστήμονας.** — Ты станешь великим учёным.
`,
);
const word = parseWordFile(file, words);
assert(word.paradigm.conjugations.future.simple[0] === 'θα γίνω', 'file future');
assert(word.extraSections.some((section) => section.title.toLowerCase() === 'контекст'), 'context kept');
assert(!word.extraSections.some((section) => section.title.toLowerCase() === 'спряжение'), 'conjugation not extra');
assert(!word.extraSections.some((section) => section.title.toLowerCase() === 'повелительное'), 'imperative not extra');
assert(word.formExamples && word.formExamples['θα γίνω'], 'formExamples parsed');
assert(word.formExamples['θα γίνω'].greek === 'Θα γίνω καλύτερος άνθρωπος.', 'example greek');
assert(word.formExamples['θα γίνω'].translation === 'Я стану лучшим человеком.', 'example translation');

const { renderVerbParadigm } = await import('../dist/build/render/verb-cube.js');
const rendered = renderVerbParadigm(word);
assert(rendered.interactive, 'rendered is interactive');
assert(rendered.html.includes('verb-person-tabs'), 'has person tabs');
assert(rendered.html.includes('data-person-index="0"'), 'has tab 0');
assert(rendered.html.includes('data-person-index="5"'), 'has tab 5');
assert(rendered.html.includes('verb-cube-face--0'), 'has face 0');
assert(rendered.html.includes('verb-cube-face--5'), 'has face 5');
assert(rendered.html.includes('verb-tense-block--future'), 'has future tense block');
assert(rendered.html.includes('θα γίνω'), 'face 0 has 1s form');
assert(rendered.html.includes('θα γίνεις'), 'face 1 has 2s form');
assert(rendered.html.includes('data-form="θα γίνω"'), 'cell has data-form attribute');
assert(rendered.html.includes('id="verb-dialog"'), 'renders verb dialog modal');
assert(rendered.html.includes('verb-dialog-example'), 'dialog has example container');
assert(rendered.html.includes('Θα γίνω καλύτερος άνθρωπος.'), 'embedded payload includes example');

console.log('verb paradigm ok');

