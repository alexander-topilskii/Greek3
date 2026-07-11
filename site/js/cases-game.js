(function () {
  const utils = window.GreekUtils;
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

  const units = data.units ?? [];
  if (!units.length) return;

  const STAGES = ['lesson', 'endings', 'words'];
  const PROGRESS_KEY = 'greek3-cases-progress';

  const progressEl = root.querySelector('[data-cases-progress]');
  const stagePillsEl = root.querySelector('[data-cases-stages]');
  const titleEl = root.querySelector('[data-cases-title]');
  const descEl = root.querySelector('[data-cases-desc]');
  const badgeEl = root.querySelector('[data-cases-badge]');
  const scoreEl = root.querySelector('[data-cases-score]');

  const lessonView = root.querySelector('[data-cases-view="lesson"]');
  const quizView = root.querySelector('[data-cases-view="quiz"]');
  const completeView = root.querySelector('[data-cases-view="complete"]');

  const lessonTitleEl = root.querySelector('[data-cases-lesson-title]');
  const lessonBodyEl = root.querySelector('[data-cases-lesson-body]');
  const lessonPatternEl = root.querySelector('[data-cases-lesson-pattern]');
  const lessonExamplesEl = root.querySelector('[data-cases-lesson-examples]');
  const lessonHintEl = root.querySelector('[data-cases-lesson-hint]');

  const promptEl = root.querySelector('[data-cases-prompt]');
  const promptLabelEl = root.querySelector('[data-cases-prompt-label]');
  const optionsEl = root.querySelector('[data-cases-options]');
  const feedbackEl = root.querySelector('[data-cases-feedback]');

  const btnContinue = root.querySelector('[data-cases-continue]');
  const btnNext = root.querySelector('[data-cases-next]');
  const btnRestart = root.querySelector('[data-cases-restart]');

  let unitIndex = 0;
  let stageIndex = 0;
  let questionIndex = 0;
  let score = 0;
  let answered = 0;
  let locked = false;

  function shuffle(arr) {
    return utils ? utils.shuffle(arr) : arr.slice();
  }

  function escapeHtml(text) {
    return utils ? utils.escapeHtml(text) : String(text);
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.unitIndex === 'number' && saved.unitIndex >= 0 && saved.unitIndex < units.length) {
        unitIndex = saved.unitIndex;
      }
      if (typeof saved.stageIndex === 'number' && saved.stageIndex >= 0 && saved.stageIndex < STAGES.length) {
        stageIndex = saved.stageIndex;
      }
    } catch {
      /* ignore */
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ unitIndex, stageIndex, questionIndex }),
      );
    } catch {
      /* ignore */
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      /* ignore */
    }
  }

  function currentUnit() {
    return units[unitIndex];
  }

  function currentStage() {
    return STAGES[stageIndex];
  }

  function stageLabel(stage) {
    if (stage === 'lesson') return 'Правило';
    if (stage === 'endings') return 'Окончания';
    return 'Слова';
  }

  function updateHeader() {
    const unit = currentUnit();
    const stage = currentStage();
    const totalUnits = units.length;

    if (progressEl) {
      progressEl.textContent = `Блок ${unitIndex + 1} из ${totalUnits}`;
    }

    if (titleEl) {
      titleEl.textContent = `${unit.caseLabel} · ${unit.genderLabel}`;
    }

    if (descEl) {
      descEl.textContent =
        stage === 'lesson'
          ? 'Изучите правило, затем потренируйтесь на окончаниях и словах.'
          : stage === 'endings'
            ? 'Выберите правильное окончание.'
            : 'Русская фраза — выберите правильный греческий перевод.';
    }

    if (badgeEl) {
      badgeEl.textContent = unit.caseLabel;
      badgeEl.dataset.case = unit.case;
      badgeEl.hidden = stage === 'lesson';
    }

    if (scoreEl) {
      if (stage === 'lesson') {
        scoreEl.hidden = true;
      } else {
        scoreEl.hidden = false;
        scoreEl.textContent = `${score} / ${answered}`;
      }
    }

    if (stagePillsEl) {
      stagePillsEl.innerHTML = STAGES.map((s, i) => {
        const cls = [
          'cases-game-pill',
          i === stageIndex ? 'is-active' : '',
          i < stageIndex ? 'is-done' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return `<span class="${cls}">${stageLabel(s)}</span>`;
      }).join('');
    }
  }

  function showView(name) {
    [lessonView, quizView, completeView].forEach((el) => {
      if (!el) return;
      const show = el.getAttribute('data-cases-view') === name;
      el.hidden = !show;
    });
  }

  function renderLesson() {
    const unit = currentUnit();
    const lesson = unit.lesson ?? {};

    if (lessonTitleEl) lessonTitleEl.textContent = lesson.title ?? unit.caseLabel;
    if (lessonBodyEl) {
      lessonBodyEl.innerHTML = escapeHtml(lesson.body ?? '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }
    if (lessonPatternEl) {
      lessonPatternEl.textContent = lesson.pattern ?? '';
      lessonPatternEl.hidden = !lesson.pattern;
    }
    if (lessonHintEl) lessonHintEl.textContent = unit.hint ?? '';

    if (lessonExamplesEl) {
      const examples = lesson.examples ?? [];
      if (!examples.length) {
        lessonExamplesEl.hidden = true;
        lessonExamplesEl.innerHTML = '';
      } else {
        lessonExamplesEl.hidden = false;
        lessonExamplesEl.innerHTML = examples
          .map(
            (ex) =>
              `<li><span class="greek">${escapeHtml(ex.greek)}</span> — ${escapeHtml(ex.ru)}</li>`,
          )
          .join('');
      }
    }

    showView('lesson');
    updateHeader();
    btnContinue.hidden = false;
    btnNext.hidden = true;
    btnRestart.hidden = unitIndex > 0 || stageIndex > 0;
  }

  function getQuestions() {
    const unit = currentUnit();
    const stage = currentStage();
    if (stage === 'endings') return unit.endings ?? [];
    if (stage === 'words') return unit.words ?? [];
    return [];
  }

  function formatEndingOption(ending) {
    if (ending.startsWith('-') || ending.startsWith('−')) return ending;
    return `−${ending}`;
  }

  function showQuizQuestion() {
    locked = false;
    feedbackEl.hidden = true;
    feedbackEl.className = 'cases-game-feedback';
    btnNext.hidden = true;

    const unit = currentUnit();
    const stage = currentStage();
    const questions = getQuestions();

    if (!questions.length) {
      advanceStage();
      return;
    }

    if (questionIndex >= questions.length) {
      advanceStage();
      return;
    }

    const q = questions[questionIndex];
    showView('quiz');
    updateHeader();

    if (stage === 'endings') {
      if (promptLabelEl) promptLabelEl.textContent = 'Какое окончание?';
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
    } else {
      if (promptLabelEl) promptLabelEl.textContent = 'Выберите перевод';
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

  function showFeedback(correct, q) {
    locked = true;
    const stage = currentStage();
    feedbackEl.hidden = false;
    feedbackEl.className = `cases-game-feedback cases-game-feedback--${correct ? 'ok' : 'bad'}`;

    if (correct) {
      if (stage === 'endings') {
        feedbackEl.innerHTML = `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.answer ?? `${q.prompt}${q.correct}`)}</span>`;
      } else {
        feedbackEl.innerHTML = `<strong>Верно!</strong> <span class="greek">${escapeHtml(q.correct)}</span>`;
      }
    } else if (stage === 'endings') {
      feedbackEl.innerHTML = `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.answer ?? `${q.prompt}${q.correct}`)}</span>`;
    } else {
      feedbackEl.innerHTML = `<strong>Не совсем.</strong> Правильно: <span class="greek">${escapeHtml(q.correct)}</span>`;
    }

    optionsEl.querySelectorAll('.cases-game-option').forEach((btn) => {
      const val = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
      btn.disabled = true;
      const correctVal = stage === 'endings' ? q.correct : q.correct;
      if (val === correctVal) btn.classList.add('cases-game-option--correct');
      else if (btn.classList.contains('cases-game-option--picked')) {
        btn.classList.add('cases-game-option--wrong');
      }
    });

    const questions = getQuestions();
    if (questionIndex >= questions.length - 1) {
      btnNext.textContent = stageIndex >= STAGES.length - 1 && unitIndex >= units.length - 1 ? 'Готово' : 'Дальше →';
    } else {
      btnNext.textContent = 'Дальше →';
    }
    btnNext.hidden = false;
  }

  function advanceStage() {
    questionIndex = 0;
    score = 0;
    answered = 0;

    if (stageIndex < STAGES.length - 1) {
      stageIndex += 1;
      saveProgress();
      if (currentStage() === 'lesson') {
        renderLesson();
      } else {
        showQuizQuestion();
      }
      return;
    }

    if (unitIndex < units.length - 1) {
      unitIndex += 1;
      stageIndex = 0;
      saveProgress();
      renderLesson();
      return;
    }

    showComplete();
  }

  function showComplete() {
    unitIndex = units.length;
    saveProgress();
    showView('complete');
    if (progressEl) progressEl.textContent = 'Курс пройден';
    if (titleEl) titleEl.textContent = 'Отлично!';
    if (descEl) descEl.textContent = 'Вы прошли все блоки по падежам.';
    if (stagePillsEl) {
      stagePillsEl.innerHTML = STAGES.map(
        (s) => `<span class="cases-game-pill is-done">${stageLabel(s)}</span>`,
      ).join('');
    }
    if (badgeEl) badgeEl.hidden = true;
    if (scoreEl) scoreEl.hidden = true;
    btnContinue.hidden = true;
    btnNext.hidden = true;
    btnRestart.hidden = false;
  }

  function startFromBeginning() {
    unitIndex = 0;
    stageIndex = 0;
    questionIndex = 0;
    score = 0;
    answered = 0;
    clearProgress();
    renderLesson();
  }

  optionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cases-game-option');
    if (!btn || locked) return;

    const questions = getQuestions();
    const q = questions[questionIndex];
    const pick = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
    const correct = pick === q.correct;

    btn.classList.add('cases-game-option--picked');
    answered += 1;
    if (correct) score += 1;
    showFeedback(correct, q);
  });

  btnContinue.addEventListener('click', () => {
    if (currentStage() !== 'lesson') return;
    advanceStage();
  });

  btnNext.addEventListener('click', () => {
    const questions = getQuestions();
    if (questionIndex < questions.length - 1) {
      questionIndex += 1;
      saveProgress();
      showQuizQuestion();
      return;
    }
    advanceStage();
  });

  btnRestart.addEventListener('click', startFromBeginning);

  loadProgress();
  if (unitIndex >= units.length) {
    showComplete();
  } else if (currentStage() === 'lesson') {
    renderLesson();
  } else {
    showQuizQuestion();
  }
})();
