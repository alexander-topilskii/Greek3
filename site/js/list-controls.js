(function () {
  function initListControls() {
    const btnCompact = document.getElementById('btn-view-compact');
    const btnToggleGrouping = document.getElementById('btn-toggle-grouping');
    const linksRoot = document.getElementById('verbs-links');
    if (!linksRoot) return;

    // --- 1. Compact View Checkbox ---
    if (btnCompact) {
      function setCompactState(on) {
        linksRoot.classList.toggle('links-list--compact', on);
        btnCompact.classList.toggle('is-active', on);
        btnCompact.setAttribute('aria-checked', on ? 'true' : 'false');
        btnCompact.setAttribute('aria-pressed', on ? 'true' : 'false');
      }

      // Restore saved state if any
      try {
        const saved = localStorage.getItem('greek3:compact-view');
        if (saved === '1') {
          setCompactState(true);
        }
      } catch (e) {}

      btnCompact.addEventListener('click', () => {
        const on = !linksRoot.classList.contains('links-list--compact');
        setCompactState(on);
        try {
          localStorage.setItem('greek3:compact-view', on ? '1' : '0');
        } catch (e) {}
      });
    }

    // --- 2. Alphabetical Sort without Groups Toggle ---
    if (btnToggleGrouping) {
      const groups = Array.from(linksRoot.querySelectorAll('.links-group'));
      const hasHeadings = Boolean(linksRoot.querySelector('.links-group-head'));

      if (groups.length <= 1 && !hasHeadings) {
        btnToggleGrouping.hidden = true;
        btnToggleGrouping.style.display = 'none';
        return;
      }

      let flatContainer = document.getElementById('verbs-links-flat');
      if (!flatContainer) {
        flatContainer = document.createElement('div');
        flatContainer.id = 'verbs-links-flat';
        flatContainer.className = 'links-flat-list';
        flatContainer.hidden = true;
        flatContainer.style.display = 'none';
        linksRoot.appendChild(flatContainer);
      }

      function getGreekSortKey(text) {
        if (!text) return '';
        const parts = text.split(/\s+[—–-]\s+/);
        let greek = (parts[0] || text).trim();
        if (!/[\u0370-\u03ff\u1f00-\u1fff]/i.test(greek) && parts[1] && /[\u0370-\u03ff\u1f00-\u1fff]/i.test(parts[1])) {
          greek = parts[1].trim();
        }
        const matchGreekStart = greek.match(/[\u0370-\u03ff\u1f00-\u1fff].*$/);
        if (matchGreekStart) {
          greek = matchGreekStart[0];
        }
        greek = greek.replace(/^(ο|η|το|οι|τα|τον|την|του|της|των|τους|τις|ένας|μια|ένα)\s+/i, '');
        greek = greek.replace(/^["'«»(\[]+/, '').trim();
        return greek;
      }

      function compareGreekWords(aLink, bLink) {
        const labelA = aLink.querySelector('.word-link-label')?.textContent ?? '';
        const labelB = bLink.querySelector('.word-link-label')?.textContent ?? '';
        const keyA = getGreekSortKey(labelA);
        const keyB = getGreekSortKey(labelB);

        const cmp = keyA.localeCompare(keyB, 'el', { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        const cmpAccents = keyA.localeCompare(keyB, 'el');
        if (cmpAccents !== 0) return cmpAccents;
        return labelA.localeCompare(labelB, 'ru');
      }

      let originalGroupLinks = null;

      function snapshotOriginal() {
        if (originalGroupLinks) return;
        originalGroupLinks = groups.map((g) => {
          const items = g.querySelector('.links-group-items');
          return {
            group: g,
            container: items,
            links: items ? Array.from(items.querySelectorAll('.word-link')) : [],
          };
        });
      }

      function setGroupingState(isFlat) {
        snapshotOriginal();

        if (isFlat) {
          const allLinks = [];
          originalGroupLinks.forEach((entry) => {
            entry.links.forEach((link) => {
              if (!allLinks.includes(link)) allLinks.push(link);
            });
          });

          allLinks.sort(compareGreekWords);

          groups.forEach((g) => {
            g.hidden = true;
            g.style.display = 'none';
          });

          flatContainer.innerHTML = '';
          allLinks.forEach((link) => flatContainer.appendChild(link));

          flatContainer.hidden = false;
          flatContainer.style.display = '';

          btnToggleGrouping.classList.add('is-active');
          btnToggleGrouping.setAttribute('aria-checked', 'true');
          btnToggleGrouping.setAttribute('aria-pressed', 'true');
        } else {
          flatContainer.hidden = true;
          flatContainer.style.display = 'none';

          originalGroupLinks.forEach((entry) => {
            if (entry.container) {
              entry.links.forEach((link) => entry.container.appendChild(link));
            }
            entry.group.hidden = false;
            entry.group.style.display = '';
          });

          btnToggleGrouping.classList.remove('is-active');
          btnToggleGrouping.setAttribute('aria-checked', 'false');
          btnToggleGrouping.setAttribute('aria-pressed', 'false');
        }
      }

      const pageKey = 'greek3:flat-view:' + window.location.pathname;
      try {
        if (sessionStorage.getItem(pageKey) === '1') {
          setGroupingState(true);
        }
      } catch (e) {}

      btnToggleGrouping.addEventListener('click', () => {
        const isCurrentlyFlat = btnToggleGrouping.classList.contains('is-active');
        const nextFlat = !isCurrentlyFlat;
        setGroupingState(nextFlat);
        try {
          if (nextFlat) {
            sessionStorage.setItem(pageKey, '1');
          } else {
            sessionStorage.removeItem(pageKey);
          }
        } catch (e) {}
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initListControls);
  } else {
    initListControls();
  }
})();
