/**
 * variety-page.js — renders variety list view and variety detail view
 * in /varieties/index.html.
 *
 * Modes:
 *   ?v=<slug>   → variety detail page
 *   ?q=<query>  → filtered list (from search bar redirect)
 *   (no param)  → full variety list
 */

(function () {
  'use strict';

  const { esc, ratingBadge, typeBadge, packetSizesHtml } = window.SeedsUtils;
  const { loadAll, listingsForVariety } = window.SeedsData;

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const varietySlug = params.get('v');
    const query = params.get('q');

    const root = document.getElementById('variety-page-root');
    if (!root) return;

    root.innerHTML = '<div class="loading">Loading…</div>';

    let allData;
    try {
      allData = await loadAll();
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><p>Could not load variety data. ${esc(err.message)}</p></div>`;
      return;
    }

    if (varietySlug) {
      renderDetail(varietySlug, allData, root);
    } else {
      renderList(allData, root, query);
    }
  }

  // ── Detail view ──────────────────────────────────────────────────────────

  function renderDetail(slug, allData, root) {
    const { varieties } = allData;
    const variety = varieties.find(v => v.id === slug);

    if (!variety) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌱</div>
          <h2>Variety not found</h2>
          <p>No variety with the ID "<strong>${esc(slug)}</strong>" exists in the catalog.</p>
          <p><a href="/varieties/">Browse all varieties →</a></p>
        </div>`;
      return;
    }

    // Update page title and meta
    document.title = `${variety.commonName} — ${variety.varietyName} | seeds.hues.flowers`;

    const listings = listingsForVariety(variety.id, allData);

    // Build tags HTML
    const tagsHtml = (variety.tags || [])
      .map(t => `<span class="tag">${esc(t)}</span>`)
      .join('');

    // Build "where to buy" table
    const listingRows = listings.map(l => {
      const seller = l.seller;
      if (!seller) return '';
      const sellerLink = `/sellers/?s=${esc(seller.id)}`;
      const outboundUrl = l.productUrl || seller.homepage;
      const outboundLabel = `View ${esc(variety.varietyName || variety.commonName)} at ${esc(seller.name)} (opens in new tab)`;
      return `
        <tr>
          <td><a href="${esc(sellerLink)}" class="seller-name-link">${esc(seller.name)}</a>
              <div>${typeBadge(seller.type)}</div>
          </td>
          <td>${packetSizesHtml(l.packetSizes)}</td>
          <td>${ratingBadge(seller.rating)}</td>
          <td>
            <a href="${esc(outboundUrl)}"
               target="_blank"
               rel="noopener noreferrer"
               class="btn-view-seller"
               aria-label="${outboundLabel}">
              View at seller ↗
            </a>
          </td>
        </tr>`;
    }).join('');

    const tableHtml = listings.length
      ? `<div class="listings-table-wrap">
           <table class="listings-table" aria-label="Sellers offering ${esc(variety.commonName)} — ${esc(variety.varietyName)}">
             <thead>
               <tr>
                 <th scope="col">Seller</th>
                 <th scope="col">Packet sizes &amp; price</th>
                 <th scope="col">Rating</th>
                 <th scope="col">Link</th>
               </tr>
             </thead>
             <tbody>${listingRows}</tbody>
           </table>
         </div>`
      : `<div class="no-sellers-msg">
           <p>No verified listings for this variety yet. Check back as the catalog grows.</p>
         </div>`;

    // Height display
    const heightHtml = variety.heightCm
      ? `<div class="aside-card"><div class="aside-card-label">Height</div>
           <div class="aside-card-value">${esc(String(variety.heightCm))} cm (${Math.round(variety.heightCm / 2.54)}")</div>
         </div>`
      : '';

    const swatchHtml = variety.colorSwatch
      ? `<span class="color-swatch" style="background:${esc(variety.colorSwatch)};width:1.5rem;height:1.5rem;" aria-hidden="true"></span>`
      : '';

    root.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <a href="/varieties/">Flowers</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <span aria-current="page">${esc(variety.commonName)}</span>
      </nav>

      <div class="variety-detail-header">
        <h1>${swatchHtml}${esc(variety.commonName)}</h1>
        <p class="latin"><em>${esc(variety.latinName)}</em></p>
        ${variety.varietyName ? `<p class="variety-label">${esc(variety.varietyName)}</p>` : ''}
        ${tagsHtml ? `<div class="detail-meta">${tagsHtml}</div>` : ''}
      </div>

      <div class="detail-body">
        <div class="detail-description">
          <h2>About this variety</h2>
          <p>${esc(variety.description)}</p>
          ${variety.sowingNotes ? `
          <div class="detail-sowing">
            <h2>Sowing &amp; growing</h2>
            <p>${esc(variety.sowingNotes)}</p>
          </div>` : ''}
        </div>
        <aside class="detail-aside">
          ${heightHtml}
          <div class="aside-card">
            <div class="aside-card-label">Category</div>
            <div class="aside-card-value">${esc(variety.subcategory ? variety.category + ' / ' + variety.subcategory : variety.category)}</div>
          </div>
          <div class="aside-card">
            <div class="aside-card-label">Sellers</div>
            <div class="aside-card-value">${listings.length > 0 ? listings.length + ' verified' : 'None yet'}</div>
          </div>
        </aside>
      </div>

      <section class="where-to-buy" aria-labelledby="where-to-buy-heading">
        <h2 id="where-to-buy-heading">Where to buy</h2>
        ${tableHtml}
      </section>`;
  }

  // ── List view ────────────────────────────────────────────────────────────

  function renderList(allData, root, query) {
    const { varieties, listings } = allData;

    // Count verified listings per variety
    const listingCountMap = {};
    listings.forEach(l => {
      listingCountMap[l.varietyId] = (listingCountMap[l.varietyId] || 0) + 1;
    });

    let filtered = varieties.filter(v => v.category === 'flowers');

    // Apply query filter if present
    if (query) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(v =>
        v.commonName.toLowerCase().includes(q) ||
        v.latinName.toLowerCase().includes(q) ||
        (v.varietyName || '').toLowerCase().includes(q)
      );
    }

    // Sort alphabetically by common name
    filtered.sort((a, b) => a.commonName.localeCompare(b.commonName));

    document.title = query
      ? `Search: ${query} | seeds.hues.flowers`
      : 'Flower Varieties | seeds.hues.flowers';

    const countLabel = filtered.length === 1 ? '1 variety' : `${filtered.length} varieties`;

    const rows = filtered.map(v => {
      const count = listingCountMap[v.id] || 0;
      const sellerLabel = count === 1 ? '1 seller' : count === 0 ? 'No sellers yet' : `${count} sellers`;
      const swatchHtml = v.colorSwatch
        ? `<span class="color-swatch" style="background:${esc(v.colorSwatch)}" aria-hidden="true"></span>`
        : '';
      return `
        <a href="/varieties/?v=${esc(v.id)}" class="variety-row">
          ${swatchHtml}
          <div class="variety-info">
            <div class="variety-common">${esc(v.commonName)}</div>
            ${v.varietyName ? `<div class="variety-name-label">${esc(v.varietyName)}</div>` : ''}
            <div class="variety-latin"><em>${esc(v.latinName)}</em></div>
          </div>
          <div class="variety-seller-count" aria-label="${esc(sellerLabel)} carry this variety">${esc(sellerLabel)}</div>
          <span class="arrow-icon" aria-hidden="true">›</span>
        </a>`;
    }).join('');

    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-state-icon">🌱</div>
        <h2>No varieties found</h2>
        <p>Try a different search, or <a href="/varieties/">browse all varieties</a>.</p>
      </div>`;

    root.innerHTML = `
      <div class="page-header">
        <h1>Flower Varieties <span class="count">${esc(countLabel)}</span></h1>
        ${query ? `<p>Results for "<strong>${esc(query)}</strong>" — <a href="/varieties/">clear filter</a></p>` : ''}
      </div>
      <div class="variety-list" role="list">
        ${filtered.length ? rows : emptyHtml}
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
