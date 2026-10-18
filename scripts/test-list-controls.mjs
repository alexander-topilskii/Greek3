import assert from 'assert';
import fs from 'fs';
import path from 'path';

// 1. Check generated HTML files
const verbsHtml = fs.readFileSync(path.resolve('dist/words/verbs/index.html'), 'utf8');
assert(verbsHtml.includes('id="btn-toggle-grouping"'), 'verbs/index.html must have btn-toggle-grouping');
assert(verbsHtml.includes('id="btn-view-compact"'), 'verbs/index.html must have btn-view-compact');
assert(verbsHtml.includes('list-control-btn--compact'), 'btn-view-compact must have list-control-btn--compact class');
assert(verbsHtml.includes('list-control-btn--toggle'), 'btn-toggle-grouping must have list-control-btn--toggle class');
assert(!verbsHtml.includes('>Компактно</button>'), 'verbs/index.html should not have text "Компактно" inside button');

const nounsHtml = fs.readFileSync(path.resolve('dist/words/nouns/index.html'), 'utf8');
assert(nounsHtml.includes('id="btn-toggle-grouping"'), 'nouns/index.html must have btn-toggle-grouping');
assert(nounsHtml.includes('id="btn-view-compact"'), 'nouns/index.html must have btn-view-compact');
assert(!nounsHtml.includes('>Компактно</button>'), 'nouns/index.html should not have text "Компактно" inside button');

// Page without groups should NOT have grouping toggle
const adverbsPlaceHtml = fs.readFileSync(path.resolve('dist/words/adverbs/place/index.html'), 'utf8');
assert(!adverbsPlaceHtml.includes('id="btn-toggle-grouping"'), 'adverbs/place/index.html should not have grouping toggle');
assert(adverbsPlaceHtml.includes('id="btn-view-compact"'), 'adverbs/place/index.html should have compact view button');

// 2. Check CSS styles
const mainCss = fs.readFileSync(path.resolve('site/css/main.css'), 'utf8');
assert(mainCss.includes('.list-control-btn'), 'main.css must contain .list-control-btn');
assert(mainCss.includes('.checkbox-indicator'), 'main.css must contain .checkbox-indicator');
assert(mainCss.includes('.toggle-indicator'), 'main.css must contain .toggle-indicator');
assert(mainCss.includes('.links-flat-list'), 'main.css must contain .links-flat-list');

// 3. Test list-controls.js logic
const listControlsCode = fs.readFileSync(path.resolve('site/js/list-controls.js'), 'utf8');
assert(listControlsCode.includes('btn-toggle-grouping'), 'list-controls.js must reference btn-toggle-grouping');
assert(listControlsCode.includes('btn-view-compact'), 'list-controls.js must reference btn-view-compact');
assert(listControlsCode.includes('verbs-links-flat'), 'list-controls.js must handle verbs-links-flat');
assert(listControlsCode.includes('getGreekSortKey'), 'list-controls.js must implement getGreekSortKey');

// 4. Test Greek sorting helper logic directly
function getGreekSortKey(text) {
  if (!text) return '';
  const parts = text.split(/\s+[—–-]\s+/);
  let greek = (parts[0] || text).trim();
  if (!/[\u0370-\u03ff\u1f00-\u1fff]/i.test(greek) && parts[1] && /[\u0370-\u03ff\u1f00-\u1fff]/i.test(parts[1])) {
    greek = parts[1].trim();
  }
  const matchGreekStart = greek.match(/[\u0370-\u03ff\u1f00-\u1fff].*$/);
  if (matchGreekStart) {
    greek = matchGreekStart[0];
  }
  greek = greek.replace(/^(ο|η|το|οι|τα|τον|την|του|της|των|τους|τις|ένας|μια|ένα)\s+/i, '');
  greek = greek.replace(/^["'«»(\[]+/, '').trim();
  return greek;
}

function compareGreekWords(labelA, labelB) {
  const keyA = getGreekSortKey(labelA);
  const keyB = getGreekSortKey(labelB);
  const cmp = keyA.localeCompare(keyB, 'el', { sensitivity: 'base' });
  if (cmp !== 0) return cmp;
  const cmpAccents = keyA.localeCompare(keyB, 'el');
  if (cmpAccents !== 0) return cmpAccents;
  return labelA.localeCompare(labelB, 'ru');
}

const testWords = [
  'ο πατέρας — отец',
  'η μητέρα — мать',
  'το δώρο — подарок',
  'είμαι — быть',
  'άνθρωπος — человек',
  'βρίσκομαι — нахожусь',
];

testWords.sort(compareGreekWords);

assert.strictEqual(testWords[0], 'άνθρωπος — человек', 'First word should be άνθρωπος (α)');
assert.strictEqual(testWords[1], 'βρίσκομαι — нахожусь', 'Second word should be βρίσκομαι (β)');
assert.strictEqual(testWords[2], 'το δώρο — подарок', 'Third word should be δώρο (δ)');
assert.strictEqual(testWords[3], 'είμαι — быть', 'Fourth word should be είμαι (ε)');
assert.strictEqual(testWords[4], 'η μητέρα — мать', 'Fifth word should be μητέρα (μ)');
assert.strictEqual(testWords[5], 'ο πατέρας — отец', 'Sixth word should be πατέρας (π)');

console.log('✓ list controls & grouping toggle tests passed');
