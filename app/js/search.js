/**
 * search.js — client-side search using a simple trigram/substring index.
 * No external library required; works from varieties JSON loaded by data.js.
 */

(function () {
  'use strict';

  let varieties = [];
  let initialized = false;

  function normalize(str) {
    return String(str || '').toLowerCase().trim();
  }

  function score(variety, query) {
    const q = normalize(query);
    if (!q) return 0;
    const fields = [
      normalize(variety.commonName),
      normalize(variety.latinName),
      normalize(variety.varietyName),
    ];
    let best = 0;
    for (const f of fields) {
      if (f === q) { best = Math.max(best, 10); continue; }
      if (f.startsWith(q)) { best = Math.max(best, 7); continue; }
      if (f.includes(q)) { best = Math.max(best, 5); continue; }
      // partial word match
      const words = f.split(/\s+/);
      for (const w of words) {
        if (w.startsWith(q)) { best = Math.max(best, 4); break; }
        if (w.includes(q)) { best = Math.max(best, 2); break; }
      }
    }
    return best;
  }

  function search(query, limit = 8) {
    if (!initialized || !query.trim()) return [];
    return varieties
      .map(v => ({ variety: v, score: score(v, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || a.variety.commonName.localeCompare(b.variety.commonName))
      .slice(0, limit)
      .map(r => r.variety);
  }

  async function init() {
    if (initialized) return;
    const data = await window.SeedsData.load('varieties');
    varieties = data;
    initialized = true;
  }

  // ── UI wiring ────────────────────────────────────────────────────────────

  function wireSearchUI(inputEl, resultsEl) {
    if (!inputEl || !resultsEl) return;

    let activeIndex = -1;
    let currentResults = [];

    function renderResults(results) {
      currentResults = results;
      activeIndex = -1;
      if (!results.length) {
        const q = inputEl.value.trim();
        resultsEl.innerHTML = q
          ? `<div class="search-no-results">No varieties found for "<strong>${window.SeedsUtils.esc(q)}</strong>"</div>`
          : '';
        resultsEl.hidden = !q;
        return;
      }
      resultsEl.innerHTML = results
        .map((v, i) =>
          `<a href="/varieties/?v=${window.SeedsUtils.esc(v.id)}"
              class="search-result-item"
              id="sr-item-${i}"
              role="option"
              aria-selected="false">
            <span class="result-name">${window.SeedsUtils.esc(v.commonName)}${v.varietyName ? ' — ' + window.SeedsUtils.esc(v.varietyName) : ''}</span>
            <span class="result-latin">${window.SeedsUtils.esc(v.latinName)}</span>
          </a>`
        )
        .join('');
      resultsEl.hidden = false;
    }

    function highlightItem(index) {
      const items = resultsEl.querySelectorAll('.search-result-item');
      items.forEach((el, i) => {
        el.classList.toggle('is-active', i === index);
        el.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      activeIndex = index;
    }

    inputEl.addEventListener('input', () => {
      const q = inputEl.value.trim();
      if (!q) { resultsEl.hidden = true; return; }
      init().then(() => renderResults(search(q)));
    });

    inputEl.addEventListener('keydown', (e) => {
      const items = resultsEl.querySelectorAll('.search-result-item');
      if (!items.length) {
        if (e.key === 'Enter') {
          const q = inputEl.value.trim();
          if (q) window.location.href = '/varieties/?q=' + encodeURIComponent(q);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightItem(Math.min(activeIndex + 1, items.length - 1));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightItem(Math.max(activeIndex - 1, 0));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0) {
          items[activeIndex].click();
        } else {
          const q = inputEl.value.trim();
          if (q) window.location.href = '/varieties/?q=' + encodeURIComponent(q);
        }
      } else if (e.key === 'Escape') {
        resultsEl.hidden = true;
        activeIndex = -1;
      }
    });

    document.addEventListener('click', (e) => {
      if (!resultsEl.contains(e.target) && e.target !== inputEl) {
        resultsEl.hidden = true;
      }
    });

    inputEl.setAttribute('role', 'combobox');
    inputEl.setAttribute('aria-autocomplete', 'list');
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.setAttribute('aria-controls', resultsEl.id || 'search-results');
    resultsEl.setAttribute('role', 'listbox');

    // Update aria-expanded
    const obs = new MutationObserver(() => {
      inputEl.setAttribute('aria-expanded', resultsEl.hidden ? 'false' : 'true');
    });
    obs.observe(resultsEl, { attributes: true, attributeFilter: ['hidden'] });
  }

  window.SeedsSearch = { init, search, wireSearchUI };
})();
