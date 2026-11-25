# Slice 8 budget table (repair)

Per-template measured vs threshold, pass/fail. Measured over HTTP against
the built app served hermetically (`SEEDS_API_BASE=stub:parity`,
parity-catalog dataset — the rehearsal serve), 2026-11-25. Arithmetic
mirrors the hardening suite's budget block exactly (the suite enforces;
this table prints): HTML = UTF-8 bytes of the served document;
JS = sum over the page's `<script src>` + `modulepreload` assets of
gzip bytes; images = every `<img>` carrying alt + width/height from a
self-hosted source. Thresholds: `app/performance-budget.json`
(150 KB gzip JS uniform per ARCHITECTURE-BRIEF section-6, 200 KB HTML
slice-adopted ceiling, Bea section-1.3 image discipline).

| Template | URL | HTML measured | HTML threshold | JS gzip measured | JS threshold | Images | Verdict |
|---|---|---|---|---|---|---|---|
| home | / | 19,749 B (9.6%) | 204,800 B | 121,760 B (79.3%) | 153,600 B | 9/9 clean | PASS |
| variety-browse | /variety | 63,933 B (31.2%) | 204,800 B | 127,995 B (83.3%) | 153,600 B | 26/26 clean | PASS |
| variety-detail | /variety/sweet-pea-kings-ransom | 38,921 B (19.0%) | 204,800 B | 136,296 B (88.7%) | 153,600 B | 9/9 clean | PASS |
| variety-zero-seller | /variety/cosmos-lonely-bloom | 28,490 B (13.9%) | 204,800 B | 136,296 B (88.7%) | 153,600 B | 9/9 clean | PASS |
| seller-index | /seller | 49,943 B (24.4%) | 204,800 B | 126,564 B (82.4%) | 153,600 B | 3/3 clean | PASS |
| seller-shop | /seller/blue-ridge-seeds | 125,968 B (61.5%) | 204,800 B | 135,702 B (88.3%) | 153,600 B | 27/27 clean | PASS |
| crop-index | /crop | 13,275 B (6.5%) | 204,800 B | 116,486 B (75.8%) | 153,600 B | 5/5 clean | PASS |
| crop-hub | /crop/sunflower | 84,163 B (41.1%) | 204,800 B | 132,852 B (86.5%) | 153,600 B | 29/29 clean | PASS |
| series-hub | /series/sunbeam | 24,995 B (12.2%) | 204,800 B | 119,708 B (77.9%) | 153,600 B | 10/10 clean | PASS |
| state-hub | /state/oregon | 14,832 B (7.2%) | 204,800 B | 121,012 B (78.8%) | 153,600 B | 4/4 clean | PASS |
| search | /search?q=sweet+pea | 30,809 B (15.0%) | 204,800 B | 125,607 B (81.8%) | 153,600 B | 2/2 clean | PASS |
| static | /about | 11,804 B (5.8%) | 204,800 B | 115,169 B (75.0%) | 153,600 B | 3/3 clean | PASS |
| report | /report | 12,235 B (6.0%) | 204,800 B | 111,574 B (72.6%) | 153,600 B | 2/2 clean | PASS |
| account | /account | 14,145 B (6.9%) | 204,800 B | 125,914 B (82.0%) | 153,600 B | 3/3 clean | PASS |
| admin-sign-in | /admin/sign-in | 9,709 B (4.7%) | 204,800 B | 106,475 B (69.3%) | 153,600 B | 2/2 clean | PASS |

Result: 15/15 PASS. Tightest margins: variety-detail and
variety-zero-seller JS at 88.7% of budget (17,304 B headroom);
seller-shop JS at 88.3%. HTML headroom is comfortable everywhere
(worst 61.5%). Images: 143 total across templates, 0 violations.
(JS figures are post-repair: the image-manifest encoding cut ~3.7 KB
gzipped transfer per route; lab transfer runs ~20 KB above these
static sums on response headers — the LHCI medians in the PR body
are the authoritative transfer figures.)

Lab budgets (LCP 6 s guard, CLS 0.1, TBT 200 ms, JS 150 KB transfer,
zero console errors) are enforced in a real Chromium by the Lighthouse
CI workflow, not by this static table — the per-URL medians vs
thresholds are reported in the repair PR body's LHCI assertion table
(the workflow run is authoritative; F1.3).
