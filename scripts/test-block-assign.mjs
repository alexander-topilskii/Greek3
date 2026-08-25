/**
 * Unit-test: earliest textbook block wins on conflict.
 * Run: npm run build && node scripts/test-block-assign.mjs
 */
import { collectBlockAssignments } from '../dist/build/catalog-order.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const wordA = { slug: 'nouns/дом σπίτι', title: 'дом' };
const wordB = { slug: 'verbs/есть είμαι', title: 'есть' };

const wordsBySlug = new Map([
  [wordA.slug, wordA],
  [wordB.slug, wordB],
]);

const indexPages = [
  {
    sourcePath: 'blocks/07/readme.md',
    title: 'Блок 7',
    intro: '',
    sections: [],
    links: [
      { label: 'дом', href: '../../nouns/дом σπίτι.md', resolvedHref: 'nouns/дом σπίτι.html' },
      { label: 'есть', href: '../../verbs/есть είμαι.md', resolvedHref: 'verbs/есть είμαι.html' },
    ],
  },
  {
    sourcePath: 'blocks/01/readme.md',
    title: 'Блок 1',
    intro: '',
    sections: [],
    links: [
      { label: 'дом', href: '../../nouns/дом σπίτι.md', resolvedHref: 'nouns/дом σπίτι.html' },
    ],
  },
];

const map = collectBlockAssignments(indexPages, (link) => {
  const key = link.resolvedHref.replace(/\.html$/i, '');
  return wordsBySlug.get(key) ?? null;
});

assert(map.get(wordA.slug) === 1, `expected block 1 for дом, got ${map.get(wordA.slug)}`);
assert(map.get(wordB.slug) === 7, `expected block 7 for есть, got ${map.get(wordB.slug)}`);
assert(map.size === 2, `expected 2 assignments, got ${map.size}`);

console.log('ok: collectBlockAssignments earliest-wins');
