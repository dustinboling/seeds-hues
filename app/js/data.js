/**
 * data.js — load and cache JSON data files, expose as window.SeedsData
 */

(function () {
  'use strict';

  const BASE = (() => {
    // Work out the data path relative to wherever the script is served from.
    // All pages use /data/ at the app root.
    const scripts = document.querySelectorAll('script[src*="data.js"]');
    if (scripts.length) {
      const src = scripts[scripts.length - 1].src;
      return src.replace(/\/js\/data\.js.*$/, '/data/');
    }
    return '/data/';
  })();

  const cache = {};

  async function load(name) {
    if (cache[name]) return cache[name];
    const res = await fetch(BASE + name + '.json');
    if (!res.ok) throw new Error('Failed to load ' + name + '.json: ' + res.status);
    const data = await res.json();
    cache[name] = data;
    return data;
  }

  async function loadAll() {
    const [varieties, sellers, listings] = await Promise.all([
      load('varieties'),
      load('sellers'),
      load('listings'),
    ]);
    return { varieties, sellers, listings };
  }

  /** Return listings for a variety id, with seller objects attached */
  function listingsForVariety(varietyId, { listings, sellers }) {
    return listings
      .filter(l => l.varietyId === varietyId)
      .map(l => ({
        ...l,
        seller: sellers.find(s => s.id === l.sellerId) || null,
      }));
  }

  /** Return listings for a seller id, with variety objects attached */
  function listingsForSeller(sellerId, { listings, varieties }) {
    return listings
      .filter(l => l.sellerId === sellerId)
      .map(l => ({
        ...l,
        variety: varieties.find(v => v.id === l.varietyId) || null,
      }));
  }

  window.SeedsData = { load, loadAll, listingsForVariety, listingsForSeller };
})();
