(function () {
  const STORAGE_KEY = 'greek3:section-visits';
  const configEl = document.getElementById('home-sections-config');

  let sections = [];
  try {
    sections = JSON.parse(configEl?.textContent ?? '[]');
  } catch {
    sections = [];
  }
  if (!sections.length) return;

  function loadVisits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveVisits(visits) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      /* ignore */
    }
  }

  function sectionPrefix(href) {
    return String(href).replace(/index\.html$/i, '');
  }

  function detectCurrentSection() {
    const pathname = decodeURIComponent(window.location.pathname || '');
    let best = null;
    let bestLen = 0;

    for (const section of sections) {
      const href = section.href;
      const prefix = sectionPrefix(href);
      if (!prefix) continue;
      if (pathname.includes(prefix) && prefix.length >= bestLen) {
        best = href;
        bestLen = prefix.length;
      }
    }

    return best;
  }

  function recordVisit(href) {
    if (!href) return;
    const visits = loadVisits();
    visits[href] = Date.now();
    saveVisits(visits);
  }

  function reorderHomeSections() {
    const grid = document.getElementById('sections-grid');
    if (!grid) return;

    const visits = loadVisits();
    const cards = [...grid.querySelectorAll('.section-card[data-section-href]')];
    if (!cards.length) return;

    cards.sort((a, b) => {
      const hrefA = a.getAttribute('data-section-href') ?? '';
      const hrefB = b.getAttribute('data-section-href') ?? '';
      const timeA = visits[hrefA] ?? 0;
      const timeB = visits[hrefB] ?? 0;
      if (timeB !== timeA) return timeB - timeA;
      const orderA = Number(a.getAttribute('data-section-order') ?? 0);
      const orderB = Number(b.getAttribute('data-section-order') ?? 0);
      return orderA - orderB;
    });

    cards.forEach((card) => grid.appendChild(card));
  }

  const current = detectCurrentSection();
  if (current) recordVisit(current);
  reorderHomeSections();
})();
