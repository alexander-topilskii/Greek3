(function () {
  const utils = window.GreekUtils;
  const root = document.getElementById('cases-practice-page');
  const dataEl = document.getElementById('cases-game-data');
  if (!root || !dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent ?? '{}');
  } catch (e) {
    console.error('Cases practice data parse error', e);
    return;
  }

  const units = data.units ?? [];
  if (!units.length) return;

  const SESSION_SIZE = 36;
  const MATCH_PAIR_COUNT = 4;
  const PROGRESS_KEY = 'greek3-cases-practice-progress';
  const MASTERED_THRESHOLD = 0.75;
  const MASTERED_MIN = 6;

  const SKILLS = ['grammar', 'el-ru', 'ru-el'];
  const SKILL_LABELS = {
    grammar: 'формы',
    'el-ru': 'ελ→ру',
    'ru-el': 'ру→ελ',
  };

  const CASE_ORDER = ['nominative', 'genitive', 'accusative'];
  const CASE_SECTION_LABELS = {
    nominative: 'Именительный',
    genitive: 'Родительный',
    accusative: 'Винительный',
  };

  const labelEl = document.getElementById('cases-task-label');
  const ruContextEl = document.getElementById('cases-task-ru');
  const promptEl = document.getElementById('cases-task-prompt');
  const optionsEl = document.getElementById('cases-task-options');
  const matchEl = document.getElementById('cases-task-match');
  const matchLeftEl = document.getElementById('cases-match-left');
  const matchRightEl = document.getElementById('cases-match-right');
  const matchColLeft = document.getElementById('cases-match-col-left');
  const matchColRight = document.getElementById('cases-match-col-right');
  const feedbackEl = document.getElementById('cases-task-feedback');
  const btnNext = document.getElementById('cases-task-next');
  const btnAgain = document.getElementById('cases-task-again');
  const scoreEl = document.getElementById('cases-session-score');

  const progressToggle = document.getElementById('cases-progress-toggle');
  const progressGrid = document.getElementById('cases-progress-grid');
  const progressDetail = document.getElementById('cases-progress-detail');
  const progressStudying = document.getElementById('cases-progress-studying');
  const progressTotal = document.getElementById('cases-progress-total');
  const progressFullscreen = document.getElementById('cases-progress-fullscreen');
  const progressFullscreenClose = document.getElementById('cases-progress-fullscreen-close');
  const legendMastered = document.getElementById('cases-legend-mastered');
  const legendLearning = document.getElementById('cases-legend-learning');
  const legendNew = document.getElementById('cases-legend-new');

  let queue = [];
  let index = 0;
  let score = 0;
  let answered = 0;
  let locked = false;
  let currentCellId = null;

  let matchPairs = [];
  let matchSelected = { left: null, right: null };
  let matchMatched = new Set();
  let matchWrongFlash = null;
  let matchLeftSide = 'greek';

  let progress = { cells: {} };

  function shuffle(arr) {
    return utils ? utils.shuffle(arr) : arr.slice().sort(() => Math.random() - 0.5);
  }

  function escapeHtml(text) {
    return utils ? utils.escapeHtml(text) : String(text);
  }

  function unitTopic(unit) {
    const num = unit.numberLabel ?? 'ед. число';
    return `${unit.caseLabel} · ${unit.genderLabel} · ${num}`;
  }

  function unitShort(unit) {
    const genderShort = {
      masculine: 'м.',
      feminine: 'ж.',
      neuter: 'ср.',
      mixed: 'м/ж',
    };
    const num = (unit.numberLabel ?? 'ед. число').includes('мн') ? 'мн.' : 'ед.';
    return `${genderShort[unit.gender] ?? unit.genderLabel} · ${num}`;
  }

  function cellId(unitId, skill) {
    return `${unitId}:${skill}`;
  }

  function parsePrompt(prompt) {
    const parts = (prompt ?? '').trim().split(/\s+/);
    if (!parts.length) return { article: '', stem: prompt ?? '' };
    const article = parts[0];
    const articles = new Set([
      'ο', 'η', 'το', 'του', 'της', 'τον', 'την', 'οι', 'τα', 'των', 'τους', 'τις',
    ]);
    if (articles.has(article)) {
      return { article, stem: parts.slice(1).join(' ') };
    }
    return { article: '', stem: prompt ?? '' };
  }

  const ARTICLES_BY_PROFILE = {
    'nominative-masculine-singular': ['ο', 'η', 'το', 'του'],
    'nominative-feminine-singular': ['η', 'ο', 'το', 'την'],
    'nominative-neuter-singular': ['το', 'ο', 'η', 'του'],
    'nominative-masculine-plural': ['οι', 'τα', 'τους', 'τις'],
    'nominative-feminine-plural': ['οι', 'τα', 'τις', 'τους'],
    'nominative-neuter-plural': ['τα', 'οι', 'το', 'των'],
    'nominative-mixed-singular': ['ο', 'η', 'το', 'τον'],
    'nominative-mixed-plural': ['οι', 'τα', 'τους', 'τις'],
    'genitive-masculine-singular': ['του', 'της', 'το', 'των'],
    'genitive-feminine-singular': ['της', 'του', 'το', 'την'],
    'genitive-neuter-singular': ['του', 'της', 'το', 'των'],
    'genitive-masculine-plural': ['των', 'τους', 'οι', 'τις'],
    'genitive-feminine-plural': ['των', 'τους', 'της', 'οι'],
    'genitive-neuter-plural': ['των', 'τους', 'του', 'τα'],
    'genitive-mixed-singular': ['του', 'της', 'τον', 'την'],
    'genitive-mixed-plural': ['των', 'τους', 'τις', 'τα'],
    'accusative-masculine-singular': ['τον', 'την', 'το', 'του'],
    'accusative-feminine-singular': ['την', 'τον', 'το', 'της'],
    'accusative-neuter-singular': ['το', 'τον', 'την', 'του'],
    'accusative-masculine-plural': ['τους', 'τις', 'τα', 'οι'],
    'accusative-feminine-plural': ['τις', 'τους', 'τα', 'την'],
    'accusative-neuter-plural': ['τα', 'τους', 'τις', 'το'],
    'accusative-mixed-singular': ['τον', 'την', 'το', 'τους'],
    'accusative-mixed-plural': ['τους', 'τις', 'τα', 'οι'],
  };

  function profileKey(unit) {
    const number = (unit.numberLabel ?? 'ед. число').includes('мн') ? 'plural' : 'singular';
    return `${unit.case}-${unit.gender}-${number}`;
  }

  function articleOptions(unit, correct) {
    const key = profileKey(unit);
    const base = ARTICLES_BY_PROFILE[key] ?? ['ο', 'η', 'το', 'του', 'της', 'τον', 'την'];
    const opts = [correct];
    for (const a of shuffle(base)) {
      if (opts.length >= 4) break;
      if (a !== correct && !opts.includes(a)) opts.push(a);
    }
    while (opts.length < 4) {
      for (const a of ['ο', 'η', 'το', 'του', 'της', 'τον', 'την', 'οι', 'τα', 'των', 'τους', 'τις']) {
        if (opts.length >= 4) break;
        if (a !== correct && !opts.includes(a)) opts.push(a);
      }
      break;
    }
    return shuffle(opts);
  }

  function formatEndingOption(ending) {
    if (ending.startsWith('-') || ending.startsWith('−')) return ending;
    return `−${ending}`;
  }

  function formLabel(unit) {
    return `${unit.caseLabel}, ${unit.genderLabel}, ${unit.numberLabel ?? 'ед. число'}`;
  }

  function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeGreek(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[.,;:!?…]/g, '')
      .trim();
  }

  function getNounFromForm(wordForm) {
    const parts = String(wordForm ?? '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? '';
  }

  function collectSentenceContexts() {
    const contexts = [];
    for (const unit of units) {
      for (const word of unit.words ?? []) {
        contexts.push({ ru: word.ru, greek: word.correct, unit, source: 'correct' });
        for (const wrong of word.wrong ?? []) {
          contexts.push({ ru: word.ru, greek: wrong, unit, source: 'wrong' });
        }
      }
      for (const example of unit.lesson?.examples ?? []) {
        contexts.push({ ru: example.ru, greek: example.greek, unit, source: 'example' });
      }
    }
    return contexts;
  }

  let sentenceContextsCache = null;

  function sentenceContexts() {
    if (!sentenceContextsCache) sentenceContextsCache = collectSentenceContexts();
    return sentenceContextsCache;
  }

  function sentenceContainsForm(sentence, wordForm) {
    const noun = normalizeGreek(getNounFromForm(wordForm));
    if (!noun) return false;
    return normalizeGreek(sentence)
      .split(/\s+/)
      .some((token) => token === noun);
  }

  function inferRuFromSentenceTail(greekSentence) {
    const parts = greekSentence.trim().split(/\s+/);
    if (parts.length < 3) return null;
    const tail = normalizeGreek(parts.slice(2).join(' '));
    for (const ctx of sentenceContexts()) {
      if (ctx.source !== 'correct') continue;
      const ctxParts = ctx.greek.trim().split(/\s+/);
      if (ctxParts.length < 3) continue;
      if (normalizeGreek(ctxParts.slice(2).join(' ')) === tail) return ctx.ru;
    }
    return null;
  }

  function resolvePhraseContext(unit, item, wordForm) {
    if (item.context?.ru && item.context?.greek) {
      return { ru: item.context.ru, greek: item.context.greek };
    }

    const matches = sentenceContexts().filter((ctx) => sentenceContainsForm(ctx.greek, wordForm));
    const preferred = matches.find((ctx) => ctx.source === 'correct' || ctx.source === 'example');
    if (preferred) return { ru: preferred.ru, greek: preferred.greek };

    for (const ctx of matches) {
      const ru = inferRuFromSentenceTail(ctx.greek);
      if (ru) return { ru, greek: ctx.greek };
    }

    return null;
  }

  function findPhraseIndex(sentence, phrase) {
    const words = phrase.trim().split(/\s+/);
    const regex = new RegExp(words.map(escapeRegex).join('\\s+'), 'iu');
    const match = sentence.match(regex);
    return match ? { index: match.index, length: match[0].length, text: match[0] } : null;
  }

  function preserveCase(template, value) {
    if (!template || !value) return value;
    return template[0] === template[0].toUpperCase()
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;
  }

  function buildGreekWithArticleBlank(greek, wordForm) {
    const parts = wordForm.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const article = parts[0];
    const noun = parts.slice(1).join(' ');
    const variants = [article, article.charAt(0).toUpperCase() + article.slice(1)];

    for (const variant of variants) {
      const regex = new RegExp(`(${escapeRegex(variant)})(\\s+)(${escapeRegex(noun)})`, 'iu');
      if (regex.test(greek)) return greek.replace(regex, '___$2$3');
    }
    return null;
  }

  function buildGreekWithEndingBlank(greek, prompt, correct) {
    const complete = `${prompt}${correct}`.trim();
    const match = findPhraseIndex(greek, complete);
    if (match) {
      const promptParts = prompt.trim().split(/\s+/);
      const blank =
        promptParts.length > 1
          ? `${match.text.split(/\s+/)[0]} ${promptParts.slice(1).join('')}___`
          : `${prompt}___`;
      return greek.slice(0, match.index) + blank + greek.slice(match.index + match.length);
    }

    const noun = getNounFromForm(complete);
    const nounMatch = findPhraseIndex(greek, noun);
    if (!nounMatch) return null;

    const stem = prompt.trim().split(/\s+/).pop() ?? prompt;
    const blankNoun = preserveCase(nounMatch.text, `${stem}___`);
    return greek.slice(0, nounMatch.index) + blankNoun + greek.slice(nounMatch.index + nounMatch.length);
  }

  function formatGreekWithBlank(text) {
    if (!text.includes('___')) {
      return `<span class="greek">${escapeHtml(text)}</span>`;
    }
    return text
      .split('___')
      .map((part, index) => {
        const chunk = `<span class="greek">${escapeHtml(part)}</span>`;
        return index === 0 ? chunk : `<span class="cases-game-blank">___</span>${chunk}`;
      })
      .join('');
  }

  function setRuContext(ru) {
    if (!ruContextEl) return;
    if (ru) {
      ruContextEl.textContent = ru;
      ruContextEl.hidden = false;
      ruContextEl.removeAttribute('hidden');
    } else {
      ruContextEl.textContent = '';
      ruContextEl.hidden = true;
      ruContextEl.setAttribute('hidden', '');
    }
  }

  function setPhrasePrompt(greekBlank) {
    if (!promptEl) return;
    promptEl.innerHTML = formatGreekWithBlank(greekBlank);
    promptEl.classList.add('greek', 'cases-context-el');
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      progress = JSON.parse(raw);
      if (!progress.cells) progress.cells = {};
    } catch {
      progress = { cells: {} };
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      /* ignore */
    }
  }

  function ensureCell(id) {
    if (!progress.cells[id]) {
      progress.cells[id] = { correct: 0, total: 0 };
    }
    return progress.cells[id];
  }

  function cellState(id) {
    const cell = ensureCell(id);
    if (cell.total === 0) return 'new';
    const ratio = cell.correct / cell.total;
    if (cell.total >= MASTERED_MIN && ratio >= MASTERED_THRESHOLD) return 'mastered';
    return 'learning';
  }

  function recordAnswer(id, correct) {
    const cell = ensureCell(id);
    cell.total += 1;
    if (correct) cell.correct += 1;
    saveProgress();
    renderProgress();
  }

  function allCellIds() {
    const ids = [];
    for (const unit of units) {
      for (const skill of SKILLS) {
        ids.push(cellId(unit.id, skill));
      }
    }
    return ids;
  }

  function renderProgressTile(id, detailed) {
    const [unitId, skill] = id.split(':');
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return '';
    const state = cellState(id);
    const isCurrent = id === currentCellId;
    const cls = [
      'cases-progress-chip',
      `cases-progress-chip--${state}`,
      isCurrent ? 'cases-progress-chip--current' : '',
      detailed ? 'cases-progress-chip--detail' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const title = detailed
      ? `${unitTopic(unit)} · ${SKILL_LABELS[skill] ?? skill}`
      : SKILL_LABELS[skill] ?? skill;
    return `<span class="${cls}" role="listitem" data-cell-id="${escapeHtml(id)}" title="${escapeHtml(title)}"><span class="cases-progress-chip-label">${escapeHtml(SKILL_LABELS[skill] ?? skill)}</span></span>`;
  }

  function renderUnitTile(unit, detailed) {
    const chips = SKILLS.map((skill) => renderProgressTile(cellId(unit.id, skill), false)).join('');
    const caseCls = `cases-progress-unit cases-progress-unit--${unit.case}`;
    const label = detailed ? unitTopic(unit) : unitShort(unit);
    return `
      <div class="${caseCls}${detailed ? ' cases-progress-unit--detail' : ''}" role="listitem" data-unit-id="${escapeHtml(unit.id)}">
        <span class="cases-progress-unit-label">${escapeHtml(label)}</span>
        <div class="cases-progress-unit-chips">${chips}</div>
      </div>`;
  }

  function renderProgress() {
    const ids = allCellIds();
    let mastered = 0;
    let learning = 0;
    let studying = 0;

    for (const id of ids) {
      const state = cellState(id);
      if (state === 'mastered') mastered += 1;
      else if (state === 'learning') {
        learning += 1;
        studying += 1;
      } else studying += 1;
    }

    if (progressStudying) progressStudying.textContent = String(studying);
    if (progressTotal) progressTotal.textContent = String(ids.length);
    if (legendMastered) legendMastered.textContent = `${mastered} усвоено`;
    if (legendLearning) legendLearning.textContent = `${learning} в работе`;
    if (legendNew) legendNew.textContent = `${ids.length - mastered - learning} новых`;

    if (progressGrid) {
      progressGrid.innerHTML = units
        .slice(0, 8)
        .map((unit) => {
          const states = SKILLS.map((s) => cellState(cellId(unit.id, s)));
          const worst = states.includes('new')
            ? 'new'
            : states.includes('learning')
              ? 'learning'
              : 'mastered';
          return `<span class="cases-progress-mini cases-progress-mini--${worst}${unit.id === currentCellId?.split(':')[0] ? ' cases-progress-mini--current' : ''}" role="listitem" title="${escapeHtml(unitTopic(unit))}"></span>`;
        })
        .join('');
    }

    if (progressDetail) {
      const byCase = CASE_ORDER.map((caseName) => {
        const caseUnits = units.filter((u) => u.case === caseName);
        if (!caseUnits.length) return '';
        const tiles = caseUnits.map((u) => renderUnitTile(u, true)).join('');
        return `
          <section class="cases-progress-case-group" data-case="${caseName}">
            <h3 class="cases-progress-case-title cases-progress-case-title--${caseName}">${escapeHtml(CASE_SECTION_LABELS[caseName] ?? caseName)}</h3>
            <div class="cases-progress-case-grid">${tiles}</div>
          </section>`;
      }).join('');
      progressDetail.innerHTML = byCase;
    }
  }

  function buildPool() {
    const pool = {
      article: [],
      ending: [],
      translateElRu: [],
      translateRuEl: [],
      matchForms: [],
      matchMulti: [],
      formsId: [],
    };

    const allTranslate = [];

    for (const unit of units) {
      const topic = unitTopic(unit);

      for (const item of unit.endings ?? []) {
        const parsed = parsePrompt(item.prompt);
        const answer = item.answer ?? `${item.prompt}${item.correct}`;
        const context = resolvePhraseContext(unit, item, answer);

        if (context) {
          const endingBlank = buildGreekWithEndingBlank(context.greek, item.prompt, item.correct);
          if (endingBlank) {
            pool.ending.push({
              type: 'ending',
              cellId: cellId(unit.id, 'grammar'),
              topic,
              unit,
              prompt: item.prompt,
              correct: item.correct,
              wrong: item.wrong ?? [],
              answer,
              ruContext: context.ru,
              greekFull: context.greek,
              greekBlank: endingBlank,
            });
          }

          if (parsed.article) {
            const articleBlank = buildGreekWithArticleBlank(context.greek, answer);
            if (articleBlank) {
              pool.article.push({
                type: 'article',
                cellId: cellId(unit.id, 'grammar'),
                topic,
                unit,
                stem: parsed.stem,
                word: answer,
                correct: parsed.article,
                ruContext: context.ru,
                greekFull: context.greek,
                greekBlank: articleBlank,
              });
            }
          }
        }

        pool.formsId.push({
          greek: answer,
          label: formLabel(unit),
          unit,
        });
      }

      for (const item of unit.words ?? []) {
        pool.translateElRu.push({
          type: 'translate-el-ru',
          cellId: cellId(unit.id, 'el-ru'),
          topic,
          unit,
          greek: item.correct,
          correct: item.ru,
          wrong: shuffle(unit.words ?? [])
            .filter((w) => w.ru !== item.ru)
            .map((w) => w.ru)
            .slice(0, 3),
        });

        pool.translateRuEl.push({
          type: 'translate-ru-el',
          cellId: cellId(unit.id, 'ru-el'),
          topic,
          unit,
          ru: item.ru,
          correct: item.correct,
          wrong: item.wrong ?? [],
        });

        allTranslate.push({ greek: item.correct, ru: item.ru, unit });
        pool.matchMulti.push({ greek: item.correct, ru: item.ru, unit });
      }
    }

    for (let i = 0; i < pool.formsId.length - 2; i += 3) {
      const trio = pool.formsId.slice(i, i + 3);
      if (trio.length === 3 && new Set(trio.map((t) => t.unit.id)).size === 3) {
        pool.matchForms.push({
          type: 'forms-id',
          cellId: cellId(trio[0].unit.id, 'grammar'),
          pairs: trio.map((t, idx) => ({ id: idx, greek: t.greek, label: t.label, unit: t.unit })),
        });
      }
    }

    if (!pool.matchForms.length) {
      const shuffled = shuffle(pool.formsId);
      while (shuffled.length >= 3) {
        const trio = shuffled.splice(0, 3);
        if (new Set(trio.map((t) => t.unit.id)).size >= 2) {
          pool.matchForms.push({
            type: 'forms-id',
            cellId: cellId(trio[0].unit.id, 'grammar'),
            pairs: trio.map((t, idx) => ({ id: idx, greek: t.greek, label: t.label, unit: t.unit })),
          });
        }
      }
    }

    return pool;
  }

  function pickWeighted(poolItems) {
    const weighted = poolItems.map((item) => {
      const state = cellState(item.cellId);
      const weight = state === 'new' ? 4 : state === 'learning' ? 3 : 1;
      return { item, weight };
    });
    let total = weighted.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of weighted) {
      r -= w.weight;
      if (r <= 0) return w.item;
    }
    return weighted[weighted.length - 1]?.item ?? poolItems[0];
  }

  function buildMatchMulti(pool, used) {
    const sources = shuffle(pool.matchMulti.filter((p) => p.greek && p.ru && !used.has(p.greek)));
    const pairs = sources.slice(0, MATCH_PAIR_COUNT);
    if (pairs.length < 3) return null;
    pairs.forEach((p) => used.add(p.greek));
    const unit = pairs[0].unit;
    return {
      type: 'match-multi',
      cellId: cellId(unit.id, 'el-ru'),
      pairs: pairs.map((p, i) => ({ id: i, greek: p.greek, ru: p.ru })),
    };
  }

  function buildSession(pool) {
    const buckets = [
      ...pool.article,
      ...pool.article,
      ...pool.ending,
      ...pool.ending,
      ...pool.ending,
      ...pool.translateElRu,
      ...pool.translateElRu,
      ...pool.translateElRu,
      ...pool.translateRuEl,
      ...pool.translateRuEl,
      ...pool.translateRuEl,
      ...shuffle(pool.matchForms),
      ...shuffle(pool.matchForms),
    ];

    const usedMatch = new Set();
    const session = [];
    let bucketIdx = 0;

    while (session.length < SESSION_SIZE && bucketIdx < buckets.length * 2) {
      if (session.length > 0 && session.length % 8 === 0) {
        const match = buildMatchMulti(pool, usedMatch);
        if (match) {
          session.push(match);
          continue;
        }
      }
      if (bucketIdx < buckets.length) {
        session.push(pickWeighted([buckets[bucketIdx]]));
        bucketIdx += 1;
      } else break;
    }

    while (session.length < SESSION_SIZE && bucketIdx < buckets.length) {
      session.push(pickWeighted([buckets[bucketIdx++]]));
    }

    return shuffle(session);
  }

  function updateScore() {
    if (scoreEl) scoreEl.textContent = `${score} / ${answered}`;
  }

  function clearFeedback() {
    if (!feedbackEl) return;
    feedbackEl.hidden = true;
    feedbackEl.className = 'cases-game-feedback';
    feedbackEl.innerHTML = '';
  }

  function showQuizUI() {
    if (optionsEl) optionsEl.hidden = false;
    if (matchEl) matchEl.hidden = true;
  }

  function showMatchUI(leftLabel, rightLabel, leftSide) {
    if (optionsEl) optionsEl.hidden = true;
    if (matchEl) matchEl.hidden = false;
    if (matchColLeft) matchColLeft.textContent = leftLabel;
    if (matchColRight) matchColRight.textContent = rightLabel;
    matchLeftSide = leftSide;
  }

  function typeLabel(type) {
    if (type === 'article') return 'Выберите артикль';
    if (type === 'ending') return 'Выберите окончание';
    if (type === 'translate-el-ru') return 'Выберите перевод (ελ → ру)';
    if (type === 'translate-ru-el') return 'Выберите перевод (ру → ελ)';
    if (type === 'match-multi') return 'Сопоставьте пары';
    if (type === 'forms-id') return 'Сопоставьте формы с падежом, родом и числом';
    return 'Задание';
  }

  function renderMatch(pairs, leftKey, rightKey, columns) {
    showMatchUI(columns.leftLabel, columns.rightLabel, columns.leftKey);
    locked = false;
    matchPairs = pairs;
    matchMatched = new Set();
    matchSelected = { left: null, right: null };
    if (matchWrongFlash) {
      clearTimeout(matchWrongFlash);
      matchWrongFlash = null;
    }

    const leftItems = shuffle(pairs.map((p) => ({ ...p, side: 'left' })));
    const rightItems = shuffle(pairs.map((p) => ({ ...p, side: 'right' })));

    const leftClass = columns.leftGreek ? 'cases-review-chip greek' : 'cases-review-chip';
    const rightClass = columns.rightGreek ? 'cases-review-chip greek' : 'cases-review-chip';

    matchLeftEl.innerHTML = leftItems
      .map(
        (p) =>
          `<button type="button" class="${leftClass}" data-match-id="${p.id}" data-match-side="left">${escapeHtml(p[leftKey])}</button>`,
      )
      .join('');

    matchRightEl.innerHTML = rightItems
      .map(
        (p) =>
          `<button type="button" class="${rightClass}" data-match-id="${p.id}" data-match-side="right">${escapeHtml(p[rightKey])}</button>`,
      )
      .join('');
  }

  function renderQuestion() {
    clearFeedback();
    if (btnNext) btnNext.hidden = true;
    locked = false;

    if (index >= queue.length) {
      showSessionComplete();
      return;
    }

    const q = queue[index];
    currentCellId = q.cellId;
    renderProgress();

    if (q.type === 'match-multi' || q.type === 'forms-id') {
      setRuContext(null);
      if (labelEl) labelEl.textContent = `${typeLabel(q.type)} · ${index + 1} / ${queue.length}`;
      if (promptEl) {
        promptEl.textContent =
          q.type === 'forms-id'
            ? 'Нажмите греческую форму, затем описание падежа, рода и числа.'
            : 'Нажмите русскую фразу, затем греческий перевод.';
        promptEl.classList.remove('greek');
      }
      if (q.type === 'forms-id') {
        renderMatch(q.pairs, 'greek', 'label', {
          leftLabel: 'Ελληνικά',
          rightLabel: 'Падеж · род · число',
          leftKey: 'greek',
          leftGreek: true,
          rightGreek: false,
        });
      } else {
        renderMatch(q.pairs, 'ru', 'greek', {
          leftLabel: 'Русский',
          rightLabel: 'Ελληνικά',
          leftKey: 'ru',
          leftGreek: false,
          rightGreek: true,
        });
      }
      return;
    }

    showQuizUI();
    if (labelEl) labelEl.textContent = typeLabel(q.type);

    if (q.type === 'ending') {
      setRuContext(q.ruContext);
      setPhrasePrompt(q.greekBlank);
      const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
      optionsEl.innerHTML = options
        .map(
          (text) =>
            `<button type="button" class="cases-game-option greek" data-answer="${encodeURIComponent(text)}">${escapeHtml(formatEndingOption(text))}</button>`,
        )
        .join('');
    } else if (q.type === 'article') {
      setRuContext(q.ruContext);
      setPhrasePrompt(q.greekBlank);
      const options = articleOptions(q.unit, q.correct);
      optionsEl.innerHTML = options
        .map(
          (text) =>
            `<button type="button" class="cases-game-option greek" data-answer="${encodeURIComponent(text)}">${escapeHtml(text)}</button>`,
        )
        .join('');
    } else if (q.type === 'translate-el-ru') {
      setRuContext(null);
      if (promptEl) {
        promptEl.innerHTML = `<span class="greek">${escapeHtml(q.greek)}</span>`;
        promptEl.classList.add('greek');
        promptEl.classList.remove('cases-context-el');
      }
      const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
      optionsEl.innerHTML = options
        .map(
          (text) =>
            `<button type="button" class="cases-game-option" data-answer="${encodeURIComponent(text)}">${escapeHtml(text)}</button>`,
        )
        .join('');
    } else if (q.type === 'translate-ru-el') {
      setRuContext(null);
      if (promptEl) {
        promptEl.textContent = q.ru;
        promptEl.classList.remove('greek', 'cases-context-el');
      }
      const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
      optionsEl.innerHTML = options
        .map(
          (text) =>
            `<button type="button" class="cases-game-option greek" data-answer="${encodeURIComponent(text)}">${escapeHtml(text)}</button>`,
        )
        .join('');
    }
  }

  function revealQuiz(correct, q) {
    locked = true;
    recordAnswer(q.cellId, correct);
    feedbackEl.hidden = false;
    feedbackEl.className = `cases-game-feedback cases-game-feedback--${correct ? 'ok' : 'bad'}`;

    if (q.type === 'ending') {
      feedbackEl.innerHTML = correct
        ? `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.greekFull)}</span>`
        : `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.greekFull)}</span>`;
    } else if (q.type === 'article') {
      feedbackEl.innerHTML = correct
        ? `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.greekFull)}</span>`
        : `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.greekFull)}</span>`;
    } else if (q.type === 'translate-el-ru') {
      feedbackEl.innerHTML = correct
        ? `<strong>Верно!</strong> ${escapeHtml(q.correct)}`
        : `<strong>Не совсем.</strong> Правильно: ${escapeHtml(q.correct)}`;
    } else {
      feedbackEl.innerHTML = correct
        ? `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.correct)}</span>`
        : `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.correct)}</span>`;
    }

    optionsEl.querySelectorAll('.cases-game-option').forEach((btn) => {
      const val = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
      btn.disabled = true;
      if (val === q.correct) btn.classList.add('cases-game-option--correct');
      else if (btn.classList.contains('cases-game-option--picked')) {
        btn.classList.add('cases-game-option--wrong');
      }
    });

    if (btnNext) btnNext.hidden = false;
  }

  function finishMatch(success, q) {
    locked = true;
    answered += 1;
    if (success) score += 1;
    recordAnswer(q.cellId, success);
    updateScore();

    feedbackEl.hidden = false;
    feedbackEl.className = `cases-game-feedback cases-game-feedback--${success ? 'ok' : 'bad'}`;
    feedbackEl.innerHTML = success
      ? '<strong>Отлично!</strong> Все пары сопоставлены.'
      : '<strong>Не совсем.</strong> Попробуйте ещё раз в следующем раунде.';

    if (btnNext) btnNext.hidden = false;
  }

  function showSessionComplete() {
    showQuizUI();
    setRuContext(null);
    currentCellId = null;
    renderProgress();
    if (labelEl) labelEl.textContent = 'Раунд завершён';
    if (promptEl) {
      promptEl.textContent = `Результат: ${score} из ${answered}. Можно начать новый раунд — задания снова перемешаются.`;
      promptEl.classList.remove('greek');
    }
    if (optionsEl) optionsEl.innerHTML = '';
    clearFeedback();
    if (btnNext) btnNext.hidden = true;
    if (btnAgain) btnAgain.hidden = false;
  }

  function startSession() {
    const pool = buildPool();
    queue = buildSession(pool);
    index = 0;
    score = 0;
    answered = 0;
    if (btnAgain) btnAgain.hidden = true;
    updateScore();
    renderQuestion();
  }

  function toggleProgressFullscreen(open) {
    if (!progressFullscreen) return;
    const show = open ?? progressFullscreen.hidden;
    progressFullscreen.hidden = !show;
    progressFullscreen.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (progressToggle) progressToggle.setAttribute('aria-expanded', show ? 'true' : 'false');
    document.body.classList.toggle('cases-progress-open', show);
    if (show) renderProgress();
  }

  optionsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.cases-game-option');
    if (!btn || locked) return;
    const q = queue[index];
    if (!q || q.type === 'match-multi' || q.type === 'forms-id') return;

    const pick = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
    const correct = pick === q.correct;
    btn.classList.add('cases-game-option--picked');
    answered += 1;
    if (correct) score += 1;
    updateScore();
    revealQuiz(correct, q);
  });

  function handleMatchClick(btn) {
    if (locked) return;
    const q = queue[index];
    if (!q) return;

    const id = Number(btn.getAttribute('data-match-id'));
    const side = btn.getAttribute('data-match-side');
    if (matchMatched.has(id)) return;

    if (side === 'left') {
      matchSelected.left = id;
      matchLeftEl.querySelectorAll('.cases-review-chip').forEach((el) => el.classList.remove('cases-review-chip--selected'));
      btn.classList.add('cases-review-chip--selected');
    } else {
      matchSelected.right = id;
      matchRightEl.querySelectorAll('.cases-review-chip').forEach((el) => el.classList.remove('cases-review-chip--selected'));
      btn.classList.add('cases-review-chip--selected');
    }

    if (matchSelected.left == null || matchSelected.right == null) return;

    if (matchSelected.left === matchSelected.right) {
      const matchedId = matchSelected.left;
      matchMatched.add(matchedId);
      matchLeftEl
        .querySelector(`[data-match-id="${matchedId}"][data-match-side="left"]`)
        ?.classList.add('cases-review-chip--matched');
      matchRightEl
        .querySelector(`[data-match-id="${matchedId}"][data-match-side="right"]`)
        ?.classList.add('cases-review-chip--matched');
      matchSelected = { left: null, right: null };
      if (matchMatched.size >= matchPairs.length) {
        finishMatch(true, q);
      }
    } else {
      btn.classList.add('cases-review-chip--wrong');
      const otherEl = side === 'left' ? matchRightEl : matchLeftEl;
      otherEl?.querySelector('.cases-review-chip--selected')?.classList.add('cases-review-chip--wrong');
      matchWrongFlash = setTimeout(() => {
        root.querySelectorAll('.cases-review-chip--wrong, .cases-review-chip--selected').forEach((el) => {
          el.classList.remove('cases-review-chip--wrong', 'cases-review-chip--selected');
        });
        matchSelected = { left: null, right: null };
      }, 650);
    }
  }

  matchEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.cases-review-chip');
    if (!btn) return;
    handleMatchClick(btn);
  });

  btnNext?.addEventListener('click', () => {
    index += 1;
    renderQuestion();
  });

  btnAgain?.addEventListener('click', startSession);

  progressToggle?.addEventListener('click', () => toggleProgressFullscreen(true));
  progressFullscreenClose?.addEventListener('click', () => toggleProgressFullscreen(false));

  loadProgress();
  renderProgress();
  startSession();
})();
