import assert from 'node:assert/strict';
import { verbBaseFormsForDisplay } from '../dist/build/verb-base-forms.js';

assert.deepEqual(
  verbBaseFormsForDisplay(['έμεινα', 'μένω', 'θα μείνω']),
  ['μένω', 'έμεινα', 'θα μείνω'],
);
assert.deepEqual(verbBaseFormsForDisplay(['φεύγω']), ['φεύγω']);
assert.deepEqual(verbBaseFormsForDisplay([]), []);

console.log('test-verb-base-forms: ok');
