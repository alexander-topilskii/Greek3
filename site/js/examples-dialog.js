(function () {
  let dialog = null;
  let titleEl = null;
  let bodyEl = null;
  let closeBtn = null;

  function ensureDialog() {
    if (dialog) return Boolean(dialog);
    dialog = document.getElementById('examples-dialog');
    titleEl = document.getElementById('examples-dialog-title');
    bodyEl = document.getElementById('examples-dialog-body');
    closeBtn = document.getElementById('btn-close-examples');
    if (!dialog) return false;

    closeBtn?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dialog.close();
    });
    return true;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderBubbles(examples) {
    return examples
      .map(
        (example) => `
      <div class="context-bubble">
        <p class="context-bubble-greek greek">${escapeHtml(example.greek)}</p>
        <p class="context-bubble-ru">${escapeHtml(example.translation)}</p>
      </div>`,
      )
      .join('');
  }

  function hasExamples(word) {
    return Array.isArray(word?.examples) && word.examples.length > 0;
  }

  function syncButton(button, word) {
    if (!button) return;
    const visible = hasExamples(word);
    button.classList.toggle('hidden', !visible);
    button.toggleAttribute('hidden', !visible);
    button.disabled = !visible;
  }

  function hideButton(button) {
    syncButton(button, null);
  }

  function show(word) {
    if (!ensureDialog() || !hasExamples(word)) return;
    const title = word.translation || word.label || 'Примеры';
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) {
      bodyEl.innerHTML = `<div class="context-bubbles">${renderBubbles(word.examples)}</div>`;
    }
    dialog.showModal();
  }

  window.GreekExamples = {
    show,
    syncButton,
    hideButton,
    hasExamples,
  };
})();
