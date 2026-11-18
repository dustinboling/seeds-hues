/**
 * utils.js — shared helpers
 */

(function () {
  'use strict';

  /** HTML-escape a string to prevent XSS */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Format a price as "$X.XX" */
  function formatPrice(price) {
    if (price == null) return null;
    return '$' + Number(price).toFixed(2);
  }

  /** Format a date string "YYYY-MM-DD" as "Nov 4, 2026" */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[m - 1] + '\u00a0' + d + ',\u00a0' + y;
  }

  /**
   * Render a rating value.
   * null → "Not yet rated" badge HTML
   * number → star display (future use)
   */
  function ratingBadge(rating) {
    if (rating == null) {
      return '<span class="rating-badge" aria-label="Not yet rated">Not yet rated</span>';
    }
    const rounded = Math.round(rating * 2) / 2;
    const full = Math.floor(rounded);
    const half = rounded % 1 !== 0;
    const empty = 5 - full - (half ? 1 : 0);
    let stars = '';
    for (let i = 0; i < full; i++) stars += '★';
    if (half) stars += '½';
    for (let i = 0; i < empty; i++) stars += '☆';
    return `<span class="rating-badge" aria-label="${esc(String(rating))} out of 5 stars">${esc(stars)} ${esc(String(rating))}</span>`;
  }

  /** Capitalize first letter */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /** Type badge HTML */
  function typeBadge(type) {
    const labels = { wholesale: 'Wholesale', retail: 'Retail', specialty: 'Specialty' };
    const label = labels[type] || capitalize(type);
    return `<span class="type-badge ${esc(type)}" aria-label="Seller type: ${esc(label)}">${esc(label)}</span>`;
  }

  /**
   * Render all packet sizes for a listing as an HTML list.
   * Shows price with source/date if available, else "See seller for price".
   */
  function packetSizesHtml(packetSizes) {
    if (!packetSizes || packetSizes.length === 0) {
      return '<span class="price-see-seller">See seller for price</span>';
    }
    const items = packetSizes.map(ps => {
      const label = esc(ps.label);
      let priceHtml;
      if (ps.price != null) {
        const dateStr = ps.priceCheckDate ? formatDate(ps.priceCheckDate) : '';
        const source = ps.priceSource ? esc(ps.priceSource) : '';
        const meta = [source, dateStr ? 'checked\u00a0' + dateStr : ''].filter(Boolean).join(', ');
        priceHtml = `<span class="packet-price">${esc(formatPrice(ps.price))}</span>`
          + (meta ? `<span class="packet-price-source">${meta}</span>` : '');
      } else {
        priceHtml = `<span class="price-see-seller">See seller for price</span>`;
        if (ps.priceCheckDate) {
          priceHtml += `<span class="packet-price-source">checked\u00a0${formatDate(ps.priceCheckDate)}</span>`;
        }
      }
      return `<li class="packet-item"><span class="packet-label">${label} — </span>${priceHtml}</li>`;
    });
    return `<ul class="packet-list">${items.join('')}</ul>`;
  }

  window.SeedsUtils = { esc, formatPrice, formatDate, ratingBadge, typeBadge, packetSizesHtml, capitalize };
})();
