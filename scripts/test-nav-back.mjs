import assert from 'assert';
import { readFileSync } from 'fs';
import vm from 'vm';
import { layout } from '../dist/build/render/layout.js';

const navBackSrc = readFileSync('site/js/nav-back.js', 'utf8');

function setupTestEnv({ referrer = '', historyLength = 1, state = null, href = 'http://localhost/words/adjectives/word.html' } = {}) {
  let backCalls = 0;
  let replaceCalls = [];
  let pushStateCalls = [];
  let replaceStateCalls = [];

  const location = {
    href,
    origin: new URL(href).origin,
    protocol: new URL(href).protocol,
    replace(url) {
      replaceCalls.push(url);
    },
  };

  const history = {
    length: historyLength,
    state,
    back() {
      backCalls++;
    },
    pushState(st, title, url) {
      pushStateCalls.push({ st, title, url });
      this.state = st;
      this.length++;
    },
    replaceState(st, title, url) {
      replaceStateCalls.push({ st, title, url });
      this.state = st;
    },
  };

  const listeners = new Map();
  const document = {
    referrer,
    readyState: 'complete',
    body: {
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {},
      },
      style: {},
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };

  const window = {
    location,
    history,
    document,
    scrollY: 0,
    scrollTo: () => {},
    matchMedia: () => ({ matches: false }),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };

  const sandbox = {
    window,
    document,
    history,
    location,
    URL,
    Boolean,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(navBackSrc, sandbox);

  return {
    window,
    GreekNavBack: window.GreekNavBack,
    getBackCalls: () => backCalls,
    getReplaceCalls: () => replaceCalls,
  };
}

// Test 1: Layout markup tests
console.log('Testing layout breadcrumbs & back button markup...');
{
  const withCrumbs = layout('<div>content</div>', 'Заголовок', [
    { label: 'Главная', href: '/index.html' },
    { label: 'Раздел', href: '/words/topics/index.html' },
    { label: 'Текущая' },
  ]);

  assert(withCrumbs.includes('class="breadcrumbs-bar"'), 'Should render breadcrumbs-bar container');
  assert(withCrumbs.includes('class="btn-crumb-back"'), 'Should render btn-crumb-back');
  assert(withCrumbs.includes('href="/words/topics/index.html"'), 'Fallback href should point to immediate parent crumb');
  assert(withCrumbs.includes('aria-label="Назад"'), 'Should have accessible aria-label');

  const withoutCrumbs = layout('<div>content</div>', 'Главная', undefined);
  assert(!withoutCrumbs.includes('class="breadcrumbs-bar"'), 'Should not render breadcrumbs-bar when no breadcrumbs');
  assert(!withoutCrumbs.includes('class="btn-crumb-back"'), 'Should not render back button on root page');

  console.log('✓ Layout breadcrumbs & back button markup ok');
}

// Test 2: GreekNavBack dismisses layer if open
console.log('Testing GreekNavBack layer dismissal...');
{
  const env = setupTestEnv();
  let layerClosed = false;
  env.GreekNavBack.push('modal-test', () => {
    layerClosed = true;
  });

  assert.strictEqual(env.GreekNavBack.hasLayers(), true);
  env.GreekNavBack.goBack('/fallback.html');
  assert.strictEqual(layerClosed, true, 'Should dismiss open layer');
  assert.strictEqual(env.getReplaceCalls().length, 0, 'Should not replace URL when dismissing layer');
  console.log('✓ Layer dismissal on back ok');
}

// Test 3: Navigates back in history when internal referrer exists
console.log('Testing history.back() on same-origin referrer...');
{
  const env = setupTestEnv({
    referrer: 'http://localhost/search.html',
    historyLength: 3,
  });

  env.GreekNavBack.goBack('/fallback.html');
  assert.strictEqual(env.getBackCalls(), 1, 'Should call history.back()');
  assert.strictEqual(env.getReplaceCalls().length, 0, 'Should not call location.replace()');
  console.log('✓ Same-origin history.back() ok');
}

// Test 4: Falls back to location.replace when direct entry (no internal referrer)
console.log('Testing location.replace() fallback on direct entry...');
{
  const env = setupTestEnv({
    referrer: '',
    historyLength: 1,
  });

  env.GreekNavBack.goBack('/fallback.html');
  assert.strictEqual(env.getBackCalls(), 0, 'Should not call history.back()');
  assert.deepStrictEqual(env.getReplaceCalls(), ['/fallback.html'], 'Should replace with fallback');
  console.log('✓ Direct entry fallback ok');
}

// Test 5: External referrer (e.g. google.com) falls back to parent in app instead of exiting app
console.log('Testing external referrer fallback...');
{
  const env = setupTestEnv({
    referrer: 'https://google.com/',
    historyLength: 2,
  });

  env.GreekNavBack.goBack('/words/topics/index.html');
  assert.strictEqual(env.getBackCalls(), 0, 'Should not call history.back() into external referrer');
  assert.deepStrictEqual(env.getReplaceCalls(), ['/words/topics/index.html'], 'Should replace with internal fallback');
  console.log('✓ External referrer fallback ok');
}

// Test 6: Button click binding handles modifier keys
console.log('Testing button click binding with modifiers...');
{
  const env = setupTestEnv({
    referrer: 'http://localhost/words/index.html',
    historyLength: 2,
  });

  const buttons = [];
  const fakeBtn = {
    dataset: {},
    getAttribute: (attr) => (attr === 'href' ? '/parent.html' : null),
    addEventListener: (type, handler) => {
      fakeBtn.handler = handler;
    },
  };
  buttons.push(fakeBtn);

  env.GreekNavBack.bindCrumbBack({
    querySelectorAll: () => buttons,
  });

  assert(fakeBtn.dataset.navBackBound, 'Button should be marked as bound');

  // Click with metaKey (Cmd+click) should not be prevented and not call goBack
  let prevented = false;
  fakeBtn.handler({
    button: 0,
    metaKey: true,
    preventDefault: () => {
      prevented = true;
    },
    currentTarget: fakeBtn,
  });
  assert.strictEqual(prevented, false, 'Should allow Cmd+click to open new tab');
  assert.strictEqual(env.getBackCalls(), 0);

  // Normal click
  fakeBtn.handler({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {
      prevented = true;
    },
    currentTarget: fakeBtn,
  });
  assert.strictEqual(prevented, true, 'Should prevent default on normal click');
  assert.strictEqual(env.getBackCalls(), 1, 'Should call history.back() on normal click');
  console.log('✓ Button click binding and modifier handling ok');
}

console.log('\nAll nav-back tests passed! 🎉');
