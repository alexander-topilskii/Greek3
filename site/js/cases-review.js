(function () {
  const utils = window.GreekUtils;
  const root = document.getElementById('cases-review');
  const dataEl = document.getElementById('cases-game-data');
  if (!root || !dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent ?? '{}');
  } catch (e) {
    console.error('Cases review data parse error', e);
    return;
  }

  const units = data.units ?? [];
  if (!units.length) return;

  const SESSION_SIZE = 28;
  const MATCH_PAIR_COUNT = 4;
  const MATCH_EVERY = 7;

  const scoreEl = root.querySelector('[data-review-score]');
  const labelEl = root.querySelector('[data-review-label]');
  const promptEl = root.querySelector('[data-review-prompt]');
  const optionsEl = root.querySelector('[data-review-options]');
  const matchEl = root.querySelector('[data-review-match]');
  const matchGreekEl = root.querySelector('[data-review-match-greek]');
  const matchRuEl = root.querySelector('[data-review-match-ru]');
  const feedbackEl = root.querySelector('[data-review-feedback]');
  const btnNext = root.querySelector('[data-review-next]');
  const btnAgain = root.querySelector('[data-review-again]');

  let queue = [];
  let index = 0;
  let score = 0;
  let answered = 0;
  let locked = false;

  let matchPairs = [];
  let matchSelected = { greek: null, ru: null };
  let matchMatched = new Set();
  let matchWrongFlash = null;

  function shuffle(arr) {
    return utils ? utils.shuffle(arr) : arr.slice();
  }

  function escapeHtml(text) {
    return utils ? utils.escapeHtml(text) : String(text);
  }

  function unitTopic(unit) {
    const num = unit.numberLabel ?? 'ед. число';
    return `${unit.caseLabel} · ${unit.genderLabel} · ${num}`;
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

  function shortRuLabel(unit, answer) {
    return `${answer ?? 'форма'} (${unit.caseLabel.toLowerCase()}, ${unit.genderLabel}, ${unit.numberLabel ?? 'ед. число'})`;
  }

  function buildPool() {
    const pool = { ending: [], article: [], translate: [], matchSource: [] };

    for (const unit of units) {
      const topic = unitTopic(unit);

      for (const item of unit.endings ?? []) {
        const parsed = parsePrompt(item.prompt);
        pool.ending.push({
          type: 'ending',
          topic,
          case: unit.case,
          caseLabel: unit.caseLabel,
          prompt: item.prompt,
          correct: item.correct,
          wrong: item.wrong ?? [],
          answer: item.answer ?? `${item.prompt}${item.correct}`,
        });

        if (parsed.article) {
          pool.article.push({
            type: 'article',
            topic,
            case: unit.case,
            caseLabel: unit.caseLabel,
            stem: parsed.stem,
            word: item.answer ?? `${item.prompt}${item.correct}`,
            correct: parsed.article,
            unit,
          });
        }

        pool.matchSource.push({
          greek: item.answer ?? `${item.prompt}${item.correct}`,
          ru: shortRuLabel(unit, item.answer?.split(' ').slice(1).join(' ') || parsed.stem),
        });
      }

      for (const item of unit.words ?? []) {
        pool.translate.push({
          type: 'translate',
          topic,
          case: unit.case,
          caseLabel: unit.caseLabel,
          ru: item.ru,
          correct: item.correct,
          wrong: item.wrong ?? [],
        });
        pool.matchSource.push({ greek: item.correct, ru: item.ru });
      }
    }

    return pool;
  }

  function buildMatchExercise(pool, used) {
    const sources = shuffle(pool.matchSource.filter((p) => p.greek && p.ru && !used.has(p.greek)));
    const pairs = sources.slice(0, MATCH_PAIR_COUNT);
    if (pairs.length < 3) return null;
    pairs.forEach((p) => used.add(p.greek));
    return { type: 'match', pairs };
  }

  function buildSession(pool) {
    const buckets = [
      ...shuffle(pool.ending),
      ...shuffle(pool.ending),
      ...shuffle(pool.article),
      ...shuffle(pool.article),
      ...shuffle(pool.translate),
      ...shuffle(pool.translate),
      ...shuffle(pool.translate),
    ];
    const usedMatch = new Set();
    const session = [];
    let bucketIdx = 0;

    while (session.length < SESSION_SIZE && bucketIdx < buckets.length) {
      if (session.length > 0 && session.length % MATCH_EVERY === 0) {
        const match = buildMatchExercise(pool, usedMatch);
        if (match) {
          session.push(match);
          continue;
        }
      }
      session.push(buckets[bucketIdx]);
      bucketIdx += 1;
    }

    while (session.length < SESSION_SIZE && bucketIdx < buckets.length) {
      session.push(buckets[bucketIdx++]);
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

  function showMatchUI() {
    if (optionsEl) optionsEl.hidden = true;
    if (matchEl) matchEl.hidden = false;
  }

  function typeLabel(type) {
    if (type === 'ending') return 'Выберите окончание';
    if (type === 'article') return 'Выберите артикль';
    if (type === 'translate') return 'Выберите перевод';
    return 'Сопоставьте пары';
  }

  function renderMatch() {
    showMatchUI();
    locked = false;
    matchMatched = new Set();
    matchSelected = { greek: null, ru: null };
    if (matchWrongFlash) {
      clearTimeout(matchWrongFlash);
      matchWrongFlash = null;
    }

    if (labelEl) labelEl.textContent = typeLabel('match');
    if (promptEl) {
      promptEl.textContent = 'Нажмите греческую форму, затем русский перевод.';
      promptEl.classList.remove('greek');
    }

    const pairs = matchPairs;
    if (!matchGreekEl || !matchRuEl) return;

    const greekItems = shuffle(pairs.map((p, i) => ({ ...p, id: i })));
    const ruItems = shuffle(pairs.map((p, i) => ({ ...p, id: i })));

    matchGreekEl.innerHTML = greekItems
      .map(
        (p) =>
          `<button type="button" class="cases-review-chip greek" data-match-id="${p.id}" data-match-side="greek">${escapeHtml(p.greek)}</button>`,
      )
      .join('');

    matchRuEl.innerHTML = ruItems
      .map(
        (p) =>
          `<button type="button" class="cases-review-chip" data-match-id="${p.id}" data-match-side="ru">${escapeHtml(p.ru)}</button>`,
      )
      .join('');
  }

  function renderQuestion() {
    clearFeedback();
    btnNext.hidden = true;
    locked = false;

    if (index >= queue.length) {
      showSessionComplete();
      return;
    }

    const q = queue[index];
    if (q.type === 'match') {
      matchPairs = q.pairs;
      if (labelEl) labelEl.textContent = `${typeLabel('match')} · ${index + 1} / ${queue.length}`;
      renderMatch();
      return;
    }

    showQuizUI();
    if (labelEl) labelEl.textContent = `${typeLabel(q.type)} · ${q.topic}`;

    if (q.type === 'ending') {
      if (promptEl) {
        promptEl.innerHTML = `<span class="greek cases-game-stem">${escapeHtml(q.prompt)}</span><span class="cases-game-blank">___</span>`;
        promptEl.classList.add('greek');
      }
      const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
      optionsEl.innerHTML = options
        .map(
          (text) =>
            `<button type="button" class="cases-game-option greek" data-answer="${encodeURIComponent(text)}">${escapeHtml(formatEndingOption(text))}</button>`,
        )
        .join('');
    } else if (q.type === 'article') {
      const displayWord = (q.word ?? '').trim().split(/\s+/).slice(1).join(' ') || q.stem;
      if (promptEl) {
        promptEl.innerHTML = `<span class="cases-game-blank">___</span> <span class="greek cases-game-stem">${escapeHtml(displayWord)}</span>`;
        promptEl.classList.add('greek');
      }
      const options = articleOptions(q.unit, q.correct);
      optionsEl.innerHTML = options
        .map(
          (text) =>
            `<button type="button" class="cases-game-option greek" data-answer="${encodeURIComponent(text)}">${escapeHtml(text)}</button>`,
        )
        .join('');
    } else {
      if (promptEl) {
        promptEl.textContent = q.ru;
        promptEl.classList.remove('greek');
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
    feedbackEl.hidden = false;
    feedbackEl.className = `cases-game-feedback cases-game-feedback--${correct ? 'ok' : 'bad'}`;

    if (q.type === 'ending') {
      feedbackEl.innerHTML = correct
        ? `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.answer)}</span>`
        : `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.answer)}</span>`;
    } else if (q.type === 'article') {
      feedbackEl.innerHTML = correct
        ? `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.word)}</span>`
        : `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.word)}</span>`;
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

    btnNext.hidden = false;
  }

  function finishMatch(success) {
    locked = true;
    answered += 1;
    if (success) score += 1;
    updateScore();

    feedbackEl.hidden = false;
    feedbackEl.className = `cases-game-feedback cases-game-feedback--${success ? 'ok' : 'bad'}`;
    feedbackEl.innerHTML = success
      ? '<strong>Отлично!</strong> Все пары сопоставлены.'
      : '<strong>Не совсем.</strong> Попробуйте ещё раз в следующем раунде.';

    btnNext.hidden = false;
  }

  function showSessionComplete() {
    showQuizUI();
    if (labelEl) labelEl.textContent = 'Раунд завершён';
    if (promptEl) {
      promptEl.textContent = `Результат: ${score} из ${answered}. Можно начать новый раунд — задания снова перемешаются.`;
      promptEl.classList.remove('greek');
    }
    if (optionsEl) optionsEl.innerHTML = '';
    clearFeedback();
    btnNext.hidden = true;
    btnAgain.hidden = false;
  }

  function startSession() {
    const pool = buildPool();
    queue = buildSession(pool);
    index = 0;
    score = 0;
    answered = 0;
    btnAgain.hidden = true;
    updateScore();
    renderQuestion();
  }

  optionsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.cases-game-option');
    if (!btn || locked) return;
    const q = queue[index];
    if (!q || q.type === 'match') return;

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
    const id = Number(btn.getAttribute('data-match-id'));
    const side = btn.getAttribute('data-match-side');
    if (matchMatched.has(id)) return;

    if (side === 'greek') {
      matchSelected.greek = id;
      matchGreekEl.querySelectorAll('.cases-review-chip').forEach((el) => el.classList.remove('cases-review-chip--selected'));
      btn.classList.add('cases-review-chip--selected');
    } else {
      matchSelected.ru = id;
      matchRuEl.querySelectorAll('.cases-review-chip').forEach((el) => el.classList.remove('cases-review-chip--selected'));
      btn.classList.add('cases-review-chip--selected');
    }

    if (matchSelected.greek == null || matchSelected.ru == null) return;

    if (matchSelected.greek === matchSelected.ru) {
      const matchedId = matchSelected.greek;
      matchMatched.add(matchedId);
      matchGreekEl
        .querySelector(`[data-match-id="${matchedId}"][data-match-side="greek"]`)
        ?.classList.add('cases-review-chip--matched');
      matchRuEl
        .querySelector(`[data-match-id="${matchedId}"][data-match-side="ru"]`)
        ?.classList.add('cases-review-chip--matched');
      matchSelected = { greek: null, ru: null };
      if (matchMatched.size >= matchPairs.length) {
        finishMatch(true);
      }
    } else {
      btn.classList.add('cases-review-chip--wrong');
      const otherSide = side === 'greek' ? matchRuEl : matchGreekEl;
      otherSide?.querySelector('.cases-review-chip--selected')?.classList.add('cases-review-chip--wrong');
      matchWrongFlash = setTimeout(() => {
        root.querySelectorAll('.cases-review-chip--wrong, .cases-review-chip--selected').forEach((el) => {
          el.classList.remove('cases-review-chip--wrong', 'cases-review-chip--selected');
        });
        matchSelected = { greek: null, ru: null };
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

  startSession();
})();
