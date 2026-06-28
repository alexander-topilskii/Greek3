(function () {
  const root = document.getElementById('cases-game');
  const dataEl = document.getElementById('cases-game-data');
  if (!root || !dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent ?? '{}');
  } catch (e) {
    console.error('Cases game data parse error', e);
    return;
  }

  const items = data.items ?? [];
  if (!items.length) return;

  const ruEl = root.querySelector('[data-cases-ru]');
  const hintEl = root.querySelector('[data-cases-hint]');
  const badgeEl = root.querySelector('[data-cases-badge]');
  const optionsEl = root.querySelector('[data-cases-options]');
  const feedbackEl = root.querySelector('[data-cases-feedback]');
  const scoreEl = root.querySelector('[data-cases-score]');
  const btnNext = root.querySelector('[data-cases-next]');
  const btnRestart = root.querySelector('[data-cases-restart]');

  let order = [];
  let index = 0;
  let score = 0;
  let answered = 0;
  let locked = false;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newRound() {
    order = shuffle(items.map((_, i) => i));
    index = 0;
    score = 0;
    answered = 0;
    locked = false;
    feedbackEl.hidden = true;
    feedbackEl.className = 'cases-game-feedback';
    btnRestart.hidden = true;
    btnNext.hidden = true;
    updateScore();
    showQuestion();
  }

  function current() {
    return items[order[index]];
  }

  function updateScore() {
    scoreEl.textContent = `${score} / ${answered}`;
  }

  function showQuestion() {
    locked = false;
    feedbackEl.hidden = true;
    btnNext.hidden = true;

    const q = current();
    badgeEl.textContent = q.caseLabel;
    badgeEl.dataset.case = q.case;
    hintEl.textContent = q.hint;
    ruEl.textContent = q.ru;

    const options = shuffle([q.correct, ...q.wrong.slice(0, 3)]);
    optionsEl.innerHTML = options
      .map(
        (text) =>
          `<button type="button" class="cases-game-option greek" data-answer="${encodeURIComponent(text)}">${escapeHtml(text)}</button>`,
      )
      .join('');
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showFeedback(correct, q) {
    locked = true;
    feedbackEl.hidden = false;
    feedbackEl.className = `cases-game-feedback cases-game-feedback--${correct ? 'ok' : 'bad'}`;

    if (correct) {
      feedbackEl.innerHTML = `<strong>Верно!</strong> ${escapeHtml(q.correct)}`;
    } else {
      feedbackEl.innerHTML = `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.correct)}</span>`;
    }

    optionsEl.querySelectorAll('.cases-game-option').forEach((btn) => {
      const val = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
      btn.disabled = true;
      if (val === q.correct) btn.classList.add('cases-game-option--correct');
      else if (btn.classList.contains('cases-game-option--picked')) {
        btn.classList.add('cases-game-option--wrong');
      }
    });

    if (index >= order.length - 1) {
      btnRestart.hidden = false;
      btnNext.hidden = true;
    } else {
      btnNext.hidden = false;
    }
  }

  optionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cases-game-option');
    if (!btn || locked) return;

    const q = current();
    const pick = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
    const correct = pick === q.correct;

    btn.classList.add('cases-game-option--picked');
    answered += 1;
    if (correct) score += 1;
    updateScore();
    showFeedback(correct, q);
  });

  btnNext.addEventListener('click', () => {
    index += 1;
    showQuestion();
  });

  btnRestart.addEventListener('click', newRound);

  newRound();
})();
