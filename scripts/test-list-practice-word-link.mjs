import assert from 'assert';
import fs from 'fs';
import path from 'path';

// 1. Verify markup on list pages vs single word pages
const verbsIndexPath = path.resolve('dist/words/verbs/index.html');
assert(fs.existsSync(verbsIndexPath), 'dist/words/verbs/index.html exists');
const verbsIndexHtml = fs.readFileSync(verbsIndexPath, 'utf8');

assert(
  verbsIndexHtml.includes('class="btn btn-secondary btn-word-link hidden" id="btn-word-link" hidden aria-disabled="true">В слово →</a>'),
  'verbs index.html should contain btn-word-link ("В слово →")',
);
assert(
  !verbsIndexHtml.includes('btn-random">Случайная</button>'),
  'verbs index.html should not contain btn-random ("Случайная")',
);

const singleWordPath = path.resolve('dist/words/verbs/остаюсь μένω.html');
if (fs.existsSync(singleWordPath)) {
  const singleWordHtml = fs.readFileSync(singleWordPath, 'utf8');
  assert(
    singleWordHtml.includes('btn-random">Случайная</button>'),
    'single word page should retain btn-random ("Случайная")',
  );
}

// 2. Verify list-practice.js contains word-link sync logic
const listPracticeJs = fs.readFileSync('site/js/list-practice.js', 'utf8');
assert(listPracticeJs.includes('.btn-word-link'), 'list-practice.js should query btn-word-link');
assert(listPracticeJs.includes('syncWordLink'), 'list-practice.js should have syncWordLink');
assert(listPracticeJs.includes('hideWordLink'), 'list-practice.js should have hideWordLink');
assert(listPracticeJs.includes('wordPageHref'), 'list-practice.js should construct wordPageHref');
assert(listPracticeJs.includes('saveSessionState'), 'list-practice.js should support session resume');

console.log('✓ list practice word-link tests passed');
