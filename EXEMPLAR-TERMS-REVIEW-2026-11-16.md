# Exemplar Seller Terms Review — prepared 2026-11-16

Week 1 task from DELTA-PLAN-DEC16.md: "owner reads exemplar terms (fills
terms_reviewed_at)". This dossier is Hue's legwork so the owner only has to
approve it. **terms_reviewed_at is still NULL for all six in the catalog —
it should only be set once Dustin approves this review.**

Checked live 2026-11-16 (America/Los_Angeles) from each seller's public
site; Hudson Valley and Sunflower Steve platforms/stock also confirmed via
their own store catalogs. "No public page found" means no page linked in
navigation/footer and none found by on-page search — an unlinked page could
still exist.

## 1. Songbird Seed Co. — Squarespace — standing shop, open
- Terms: https://www.songbirdseeds.com/terms-of-service (updated Oct 1, 2026)
  - US-only shipping; orders cannot be combined
  - Purchase limits are contractual: "limit 1 per order" varieties are
    once per customer; no bots / multiple accounts; right to cancel/refuse
  - **Site content may not be reproduced or used commercially without
    written consent** — directory must keep writing its own descriptions
    and never copy Songbird copy/photos (already our rule)
- No separate shipping/returns/FAQ or wholesale page found
- No variety resale/renaming restriction stated in the Terms read
- Crawl note: safe to link out; respect per-customer limits in stock notes

## 2. Sunflower Steve Seed Co. — Shopify — episodic / sale-window
- Homepage: seed inventory sold out; a Baptisia Sphaerocarpa sale in
  November and 2027 Seed Sale dates to be announced; gift cards/merch stay
  in stock. Seed mixes in the catalog are sold out.
- Terms: https://sunflowersteveseedco.com/policies/terms-of-service —
  **page exists but rendered blank (heading only, no terms text)** when
  checked; not linked in the footer. Terms therefore NOT actually read.
- Shipping: https://sunflowersteveseedco.com/policies/shipping-policy —
  US via USPS, no guaranteed delivery times; international up to a month,
  buyer bears duties/taxes and confiscation risk
- Refund policy is footer-linked (not opened in this pass)
- No variety restriction or wholesale page found
- Crawl note: expect most seed listings sold out between sale windows

## 3. Floret — shop.floretflowers.com (Shopify-style) — episodic
- Shop currently sells only the "Bloom to Seed" book pre-order;
  **no Floret Originals seed is currently for sale** — do not present
  Floret as a buyable seed seller right now
- Terms: https://www.floretflowers.com/terms-conditions/ (updated
  July 31, 2026) — seeds non-returnable; 30-day replacement/refund for
  other items with $15 restocking fee; seeds ship US + Canada only;
  Floret may cancel/refuse orders; site content is Floret IP, no
  reproduction without permission (consistent with our names/facts-only
  Library rule)
- Shipping: https://www.floretflowers.com/shipping-delivery/ ;
  FAQ: https://www.floretflowers.com/faq/
- Terms contain no resale/renaming/attribution restriction for Floret
  Original varieties (searched: no "wholesale"/"resale" matches)
- No wholesale page found

## 4. Dawn Creek Farm — Squarespace — episodic fundraiser, OPEN NOW
- **Time-sensitive: last seed-shipping day of the year is Nov 17, 2026.**
  Next release/restock (incl. 2027 introductions) planned late Jan /
  early Feb 2027. Most named zinnia varieties sold out; a few mixes remain.
- No separate Terms page; fundraiser conditions live on the shop page:
  https://dawncreekfarm.squarespace.com/donate — US shipping only
  (will ship to a US address for overseas supporters); limit 1 packet
  per person on many varieties, extra packets go to the spring giveaway
- DISCREPANCY TO RESOLVE: this pass found no resale/renaming text on the
  fundraiser page (searched "resale"/"rename": no matches), but our
  seller file (SELLER-SEED-LIST.md, from Dustin 2026-11-15) records
  breeder terms prohibiting reselling/renaming her varieties as one's
  own, a royalty group for seed sellers, and a requirement to credit
  Dawn Creek as breeder. **Keep the attribution rule standing until the
  source of those terms is re-located — do not drop it on this search
  alone.**

## 5. Hudson Valley Seed Co. — Shopify — standing shop, open
- Terms: https://hudsonvalleyseed.com/policies/terms-of-service
  (last update April 2025) — germination guaranteed at/above federal
  minimums given proper conditions; **liability limited to the cost of
  the packet, not the value of a harvestable crop**; credit cards plus
  Apple Pay / PayPal / Shop Pay Installments
- FAQ incl. shipping + refunds: https://hudsonvalleyseed.com/pages/faqs
  (refunds section: /pages/faqs/#refunds); free shipping on seed
  orders $60+ / all orders $200+ per site banner
- Wholesale is a separate site: https://www.hudsonvalleyseedwholesale.com/
- No variety restriction stated — the most directory-friendly of the six

## 6. Wild West Seed — custom/static site — NOT a retail shop
- Wholesale/contract seed producer; **no online store or checkout**
- No Terms, shipping, returns, or FAQ pages published
- Wholesale: https://www.wildwestseed.com/seed-services — orders by
  phone/email/fax, quantities as small as 8 oz depending on variety,
  film-coating and custom color sorting on request; no prices published
- Crawl note: **do not list Wild West as a retail buy-link source** —
  link the Seed Services page for trade/wholesale inquiries only.
  This should be checked against the 17 live listings: if any Wild West
  listing currently presents as a retail buy link, it needs reclassing.

## What this means for crawl_policy per seller (proposal, owner's call)
- Songbird: crawl shop, own-words only, honour limit-1 notes — terms READ
- Sunflower Steve: crawl, expect sold-out between windows — terms NOT
  read (blank page); terms_reviewed_at should stay NULL or be set only
  with that caveat noted
- Floret: no seed listings until a sale window opens — terms READ
- Dawn Creek: fundraiser listings as gifts, 1-packet limit, attribution
  to Dawn Creek as breeder stands — conditions read on /donate, breeder
  terms source still to re-locate
- Hudson Valley: full Shopify crawl — terms READ
- Wild West: no retail crawl; Seed Services link only — no terms exist
  to read
