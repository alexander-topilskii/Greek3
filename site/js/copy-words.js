(function () {
  const db = window.GreekDB;
  const srs = window.GreekSRS;
  if (!db || !srs) return;

  const catalogEl =
    document.getElementById('verbs-catalog') ?? document.getElementById('global-catalog');
  const copyButtons = document.querySelectorAll('.btn-copy-words[data-copy-mode]');
  if (!catalogEl || !copyButtons.length) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Copy words: catalog parse error', e);
    return;
  }

  const words = catalog.words ?? [];
  if (!words.length) {
    copyButtons.forEach((btn) => {
      btn.closest('.settings-copy-words')?.setAttribute('hidden', '');
    });
    return;
  }

  const feedbackEl = document.getElementById('copy-words-feedback');
  let feedbackTimer = null;

  function formatWord(word) {
    const greek = word.primaryGreek || word.baseForms?.[0] || '';
    const ru = word.translation || word.label || '';
    if (greek && ru) return `${greek} — ${ru}`;
    return greek || ru;
  }

  function formatWordList(list) {
    return list.map(formatWord).filter(Boolean).join('\n');
  }

  function filterStudied(cards) {
    return words.filter(
      (word) =>
        srs.isWordInProgress(word.slug, cards, db) ||
        srs.isWordDoneForPool(word.slug, cards, db),
    );
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (!ok) throw new Error('Copy failed');
  }

  function showFeedback(message) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedbackEl.textContent = '';
      feedbackTimer = null;
    }, 2200);
  }

  function flashButton(btn) {
    btn.classList.add('is-copied');
    setTimeout(() => btn.classList.remove('is-copied'), 1200);
  }

  async function handleCopy(mode, btn) {
    const cards = await db.getCardsForSlugs(words.map((word) => word.slug));
    const selected = mode === 'all' ? words : filterStudied(cards);

    if (!selected.length) {
      showFeedback(
        mode === 'all' ? 'В разделе нет слов' : 'Нет слов в работе или выученных',
      );
      return;
    }

    const text = formatWordList(selected);
    try {
      await copyText(text);
      flashButton(btn);
      showFeedback(`Скопировано: ${selected.length}`);
    } catch (err) {
      console.error('Copy words failed', err);
      showFeedback('Не удалось скопировать');
    }
  }

  copyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      handleCopy(btn.getAttribute('data-copy-mode'), btn);
    });
  });

  db.init().catch(() => {});
})();
