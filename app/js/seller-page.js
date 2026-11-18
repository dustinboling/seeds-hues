/**
 * seller-page.js — renders seller directory and seller detail views
 * in /sellers/index.html.
 *
 * Modes:
 *   ?s=<slug>   → seller detail page
 *   (no param)  → seller directory
 */

(function () {
  'use strict';

  const { esc, ratingBadge, typeBadge, packetSizesHtml } = window.SeedsUtils;
  const { loadAll, listingsForSeller } = window.SeedsData;

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const sellerSlug = params.get('s');

    const root = document.getElementById('seller-page-root');
    if (!root) return;

    root.innerHTML = '<div class="loading">Loading…</div>';

    let allData;
    try {
      allData = await loadAll();
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><p>Could not load seller data. ${esc(err.message)}</p></div>`;
      return;
    }

    if (sellerSlug) {
      renderDetail(sellerSlug, allData, root);
    } else {
      renderDirectory(allData, root);
    }
  }

  // ── Detail view ──────────────────────────────────────────────────────────

  function renderDetail(slug, allData, root) {
    const { sellers } = allData;
    const seller = sellers.find(s => s.id === slug);

    if (!seller) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏪</div>
          <h2>Seller not found</h2>
          <p>No seller with the ID "<strong>${esc(slug)}</strong>" exists in the directory.</p>
          <p><a href="/sellers/">Browse all sellers →</a></p>
        </div>`;
      return;
    }

    document.title = `${seller.name} | seeds.hues.flowers`;

    const listings = listingsForSeller(seller.id, allData);

    const varietyRows = listings.map(l => {
      const variety = l.variety;
      if (!variety) return '';
      const varietyLink = `/varieties/?v=${esc(variety.id)}`;
      const outboundUrl = l.productUrl || seller.homepage;
      const outboundLabel = `View ${esc(variety.varietyName || variety.commonName)} at ${esc(seller.name)} (opens in new tab)`;
      return `
        <tr>
          <td>
            <a href="${esc(varietyLink)}">${esc(variety.commonName)}</a>
            ${variety.varietyName ? `<div style="font-size:0.8125rem;color:var(--color-text-muted)">${esc(variety.varietyName)}</div>` : ''}
            <div style="font-size:0.8125rem;font-style:italic;color:var(--color-text-muted)">${esc(variety.latinName)}</div>
          </td>
          <td>${l.sku ? `<code style="font-size:0.8125rem">${esc(l.sku)}</code>` : '—'}</td>
          <td>${packetSizesHtml(l.packetSizes)}</td>
          <td>
            <a href="${esc(outboundUrl)}"
               target="_blank"
               rel="noopener noreferrer"
               class="btn-view-seller"
               aria-label="${outboundLabel}">
              View ↗
            </a>
          </td>
        </tr>`;
    }).join('');

    const tableHtml = listings.length
      ? `<div class="listings-table-wrap">
           <table class="listings-table" aria-label="Varieties carried by ${esc(seller.name)}">
             <thead>
               <tr>
                 <th scope="col">Variety</th>
                 <th scope="col">SKU</th>
                 <th scope="col">Packet sizes &amp; price</th>
                 <th scope="col">Link</th>
               </tr>
             </thead>
             <tbody>${varietyRows}</tbody>
           </table>
         </div>`
      : `<div class="no-sellers-msg">
           <p>No verified listings for this seller yet. Listings are added as sourcing data is verified.</p>
         </div>`;

    root.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <a href="/sellers/">Sellers</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <span aria-current="page">${esc(seller.name)}</span>
      </nav>

      <div class="seller-detail-header">
        <h1>${esc(seller.name)} ${typeBadge(seller.type)}</h1>
        <a href="${esc(seller.homepage)}"
           target="_blank"
           rel="noopener noreferrer"
           class="seller-homepage-link"
           aria-label="Visit ${esc(seller.name)} website (opens in new tab)">
          ${esc(seller.homepage.replace(/^https?:\/\//, ''))}
        </a>
      </div>

      <div class="seller-info-grid">
        <div>
          <p class="seller-description">${esc(seller.description)}</p>
          ${seller.location ? `<p style="margin-top:0.5rem;font-size:0.875rem;color:var(--color-text-muted)">📍 ${esc(seller.location)}</p>` : ''}
          <div style="margin-top:1rem">${ratingBadge(seller.rating)}</div>
        </div>
        <div class="ordering-notes-box">
          <strong>Ordering notes</strong>
          ${esc(seller.orderingNotes || 'See seller website for ordering information.')}
        </div>
      </div>

      <section aria-labelledby="varieties-heading">
        <h2 id="varieties-heading" style="font-size:1.25rem;font-weight:700;margin-bottom:1rem;">
          Varieties carried
          <span style="font-weight:400;font-size:0.875rem;color:var(--color-text-muted);margin-left:0.5rem;">
            ${listings.length > 0 ? listings.length + ' verified' : '0 verified listings'}
          </span>
        </h2>
        ${tableHtml}
      </section>`;
  }

  // ── Directory view ───────────────────────────────────────────────────────

  function renderDirectory(allData, root) {
    const { sellers, listings } = allData;

    // Count listings per seller
    const listingCountMap = {};
    listings.forEach(l => {
      listingCountMap[l.sellerId] = (listingCountMap[l.sellerId] || 0) + 1;
    });

    // Sort: sellers with listings first, then alphabetical
    const sorted = [...sellers].sort((a, b) => {
      const ca = listingCountMap[a.id] || 0;
      const cb = listingCountMap[b.id] || 0;
      if (ca !== cb) return cb - ca;
      return a.name.localeCompare(b.name);
    });

    document.title = 'Seed Suppliers | seeds.hues.flowers';

    const rows = sorted.map(s => {
      const count = listingCountMap[s.id] || 0;
      const listingsLabel = count === 1 ? '1 listing' : count === 0 ? 'No listings yet' : `${count} listings`;
      return `
        <a href="/sellers/?s=${esc(s.id)}" class="seller-row">
          <div class="seller-row-info">
            <div class="seller-row-name">${esc(s.name)}</div>
            <div class="seller-row-type">${typeBadge(s.type)}
              ${s.location ? `<span style="margin-left:0.5rem;font-size:0.8125rem">📍 ${esc(s.location)}</span>` : ''}
            </div>
            <div class="seller-row-desc">${esc(s.description)}</div>
            <div class="seller-row-meta">
              ${ratingBadge(s.rating)}
              <span style="font-size:0.8125rem;color:var(--color-text-muted)">${esc(listingsLabel)}</span>
            </div>
          </div>
          <span class="arrow-icon" aria-hidden="true">›</span>
        </a>`;
    }).join('');

    root.innerHTML = `
      <div class="page-header">
        <h1>Seed Suppliers
          <span class="count" style="font-size:1rem;font-weight:400;color:var(--color-text-muted);margin-left:0.5rem;">
            ${sellers.length} suppliers
          </span>
        </h1>
        <p>Every supplier in the directory, with verified listings where sourcing data exists.</p>
      </div>
      <div class="sellers-grid" role="list">
        ${rows}
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
