/**
 * Greek3 — Book Reader Client Logic
 * Handles interactive word translation lookup, click-to-reveal sentences,
 * reading progress persistence in localStorage, font sizing, and speech synthesis.
 */

(function () {
  'use strict';

  function initReader() {
    const readerPage = document.querySelector('.reader-page');
    if (!readerPage) return;

    const bookId = readerPage.getAttribute('data-book-id') || 'book';
    const chapterId = readerPage.getAttribute('data-chapter-id') || '1';
    const storageKey = `greek3_reader_progress_${bookId}_ch${chapterId}`;
    const modeKey = 'greek3_reader_mode';
    const fontKey = 'greek3_reader_font_size';

    // Elements
    const paragraphs = Array.from(document.querySelectorAll('.reader-paragraph'));
    const totalParas = paragraphs.length;
    const progressFill = document.getElementById('reader-progress-fill');
    const progressText = document.getElementById('reader-progress-text');
    const resumeBanner = document.getElementById('reader-resume-banner');
    const resumeBtn = document.getElementById('btn-resume-reading');
    const resumeParaNum = document.getElementById('resume-para-num');

    // Controls
    const btnModeReveal = document.getElementById('btn-mode-reveal');
    const btnModeParallel = document.getElementById('btn-mode-parallel');
    const btnFontSmaller = document.getElementById('btn-font-smaller');
    const btnFontLarger = document.getElementById('btn-font-larger');

    // Popup
    const popup = document.getElementById('reader-popup');
    const popupGreek = document.getElementById('reader-popup-greek');
    const popupTrans = document.getElementById('reader-popup-trans');
    const popupCategory = document.getElementById('reader-popup-category');
    const popupCardLink = document.getElementById('reader-popup-card-link');
    const popupSpeakBtn = document.getElementById('reader-popup-speak');
    const popupCloseBtn = document.getElementById('reader-popup-close');

    let currentActiveWord = null;
    let currentPopupWordGreek = '';

    // --- 1. Mode: reveal vs parallel ---
    let currentMode = localStorage.getItem(modeKey) || 'reveal';

    function setMode(mode) {
      currentMode = mode;
      localStorage.setItem(modeKey, mode);

      if (mode === 'parallel') {
        readerPage.classList.remove('mode-reveal');
        readerPage.classList.add('mode-parallel');
        btnModeParallel?.classList.add('is-active');
        btnModeReveal?.classList.remove('is-active');
      } else {
        readerPage.classList.remove('mode-parallel');
        readerPage.classList.add('mode-reveal');
        btnModeReveal?.classList.add('is-active');
        btnModeParallel?.classList.remove('is-active');
      }
    }

    btnModeReveal?.addEventListener('click', () => setMode('reveal'));
    btnModeParallel?.addEventListener('click', () => setMode('parallel'));
    setMode(currentMode);

    // --- 2. Font Size Scaling ---
    let currentFontSize = parseFloat(localStorage.getItem(fontKey)) || 1.2;

    function applyFontSize(size) {
      currentFontSize = Math.max(0.9, Math.min(1.7, size));
      document.documentElement.style.setProperty('--reader-font-size', `${currentFontSize}rem`);
      localStorage.setItem(fontKey, String(currentFontSize));
    }

    btnFontSmaller?.addEventListener('click', () => applyFontSize(currentFontSize - 0.1));
    btnFontLarger?.addEventListener('click', () => applyFontSize(currentFontSize + 0.1));
    applyFontSize(currentFontSize);

    // --- 3. Progress Tracking & Persistence ---
    let progressData = {
      lastIndex: 0,
      readParas: [],
      updatedAt: Date.now(),
    };

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        progressData = { ...progressData, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse progress from localStorage', e);
    }

    const readSet = new Set(progressData.readParas || []);

    function updateProgressUI() {
      const count = readSet.size;
      const percent = totalParas > 0 ? Math.round((count / totalParas) * 100) : 0;
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${count} / ${totalParas} (${percent}%)`;
    }

    function saveProgress(lastIdx) {
      if (lastIdx != null) {
        progressData.lastIndex = lastIdx;
      }
      progressData.readParas = Array.from(readSet);
      progressData.updatedAt = Date.now();
      try {
        localStorage.setItem(storageKey, JSON.stringify(progressData));
      } catch (e) {}
      updateProgressUI();
    }

    function markParagraphRead(idx, toggle = false) {
      if (toggle && readSet.has(idx)) {
        readSet.delete(idx);
      } else {
        readSet.add(idx);
      }
      const el = document.getElementById(`para-${idx}`);
      if (el) {
        const isRead = readSet.has(idx);
        el.classList.toggle('is-read', isRead);
        const checkBtn = el.querySelector('.btn-para-check');
        if (checkBtn) {
          checkBtn.classList.toggle('is-read', isRead);
          checkBtn.setAttribute('title', isRead ? 'Прочитано (нажмите для отмены)' : 'Отметить как прочитано');
        }
      }
      saveProgress(idx);
    }

    // Initialize read states
    readSet.forEach((idx) => {
      const el = document.getElementById(`para-${idx}`);
      if (el) {
        el.classList.add('is-read');
        const checkBtn = el.querySelector('.btn-para-check');
        if (checkBtn) checkBtn.classList.add('is-read');
      }
    });
    updateProgressUI();

    // Check if we should show resume banner
    if (progressData.lastIndex > 1 && progressData.lastIndex <= totalParas) {
      if (resumeBanner && resumeParaNum) {
        resumeParaNum.textContent = String(progressData.lastIndex);
        resumeBanner.classList.add('is-visible');
        resumeBtn?.addEventListener('click', () => {
          resumeBanner.classList.remove('is-visible');
          scrollToParagraph(progressData.lastIndex);
        });
      }
    }

    function scrollToParagraph(idx) {
      const el = document.getElementById(`para-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('is-active-reading');
        setTimeout(() => el.classList.remove('is-active-reading'), 2000);
      }
    }

    // --- 4. Interactive Word Popup ---
    function closePopup() {
      if (popup) popup.classList.remove('is-open');
      if (currentActiveWord) {
        currentActiveWord.classList.remove('is-active-word');
        currentActiveWord = null;
      }
    }

    function openWordPopup(wordEl) {
      if (currentActiveWord) {
        currentActiveWord.classList.remove('is-active-word');
      }
      currentActiveWord = wordEl;
      currentActiveWord.classList.add('is-active-word');

      const greek = wordEl.getAttribute('data-greek') || wordEl.textContent.trim();
      const translation = wordEl.getAttribute('data-translation') || '';
      const category = wordEl.getAttribute('data-category') || '';
      const href = wordEl.getAttribute('data-href') || '';

      currentPopupWordGreek = greek;

      if (popupGreek) popupGreek.textContent = greek;
      if (popupTrans) popupTrans.textContent = translation || '—';
      if (popupCategory) {
        popupCategory.textContent = category ? `(${category})` : '';
      }

      if (popupCardLink) {
        if (href) {
          popupCardLink.href = href;
          popupCardLink.style.display = 'inline-flex';
        } else {
          popupCardLink.style.display = 'none';
        }
      }

      popup?.classList.add('is-open');
    }

    popupCloseBtn?.addEventListener('click', closePopup);

    popupSpeakBtn?.addEventListener('click', () => {
      if (window.GreekSpeak && currentPopupWordGreek) {
        window.GreekSpeak.speakGreek(currentPopupWordGreek);
      }
    });

    // Dismiss popup on outside click
    document.addEventListener('click', (e) => {
      if (popup && popup.classList.contains('is-open')) {
        if (!popup.contains(e.target) && !e.target.closest('.reader-word')) {
          closePopup();
        }
      }
    });

    // --- 5. Word & Phrase Events ---
    paragraphs.forEach((para) => {
      const idx = parseInt(para.getAttribute('data-index'), 10);

      // Paragraph speak button
      const speakBtn = para.querySelector('.btn-para-speak');
      speakBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const greekEl = para.querySelector('.reader-greek');
        if (greekEl && window.GreekSpeak) {
          const text = greekEl.textContent.replace(/\s+/g, ' ').trim();
          window.GreekSpeak.speakGreek(text);
        }
      });

      // Paragraph check/mark read button
      const checkBtn = para.querySelector('.btn-para-check');
      checkBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        markParagraphRead(idx, true);
      });

      // Russian block click: toggle reveal
      const ruBlock = para.querySelector('.reader-ru');
      ruBlock?.addEventListener('click', () => {
        para.classList.toggle('is-revealed');
        markParagraphRead(idx, false);
      });

      // Clicking inside greek text (outside words) toggles translation
      const greekBlock = para.querySelector('.reader-greek');
      greekBlock?.addEventListener('click', (e) => {
        if (e.target.classList.contains('reader-word')) {
          return; // Handled below
        }
        if (currentMode === 'reveal') {
          para.classList.toggle('is-revealed');
          markParagraphRead(idx, false);
        }
      });
    });

    // Word click handlers
    document.querySelectorAll('.reader-word').forEach((wordEl) => {
      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openWordPopup(wordEl);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReader);
  } else {
    initReader();
  }
})();
