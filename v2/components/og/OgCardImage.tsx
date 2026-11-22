/**
 * The OG card image (S3): the 1200×630 element the /og/{kind}/{slug} route hands to
 * ImageResponse. Kept out of the route module (whose .ttf byte imports only resolve under
 * Turbopack) so the render tests draw this same element through Satori.
 *
 * The Mixed disc is inline SVG wedges, not the CSS conic gradient: Satori throws
 * `Failed to parse declaration "background: conic-gradient(...)"`, which 500s the card.
 * The wedges are the same family stops the shared conic uses, in the same order — first
 * wedge at twelve o'clock, clockwise — so the OG disc reads as the same Mixed treatment.
 */
import type { OgCard } from "@/lib/seo/og-card";

// The disc frame matches the flat swatch exactly (120px circle, 4px border); the wedges
// fill its inner 112px, so no clipping is needed — the SVG corners stay transparent.
const DISC = 120;
const BORDER = 4;
const INNER = DISC - 2 * BORDER;
const C = INNER / 2;
const R = INNER / 2;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The pie-slice path for wedge `i` of `n`, starting at twelve o'clock, clockwise. */
function wedgePath(i: number, n: number): string {
  const a0 = ((-90 + (i * 360) / n) * Math.PI) / 180;
  const a1 = ((-90 + ((i + 1) * 360) / n) * Math.PI) / 180;
  const x0 = round2(C + R * Math.cos(a0));
  const y0 = round2(C + R * Math.sin(a0));
  const x1 = round2(C + R * Math.cos(a1));
  const y1 = round2(C + R * Math.sin(a1));
  return `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`;
}

export function OgCardImage({ card }: { card: OgCard }) {
  const titleSize = card.title.length > 28 ? 72 : 92;
  const wedges = card.mixWedges;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 72px 56px",
        background: "#F8F1E1",
        color: "#2E2A23",
        border: "1px solid #E0D5B8",
        fontFamily: "geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {wedges ? (
          <div
            style={{
              width: DISC,
              height: DISC,
              borderRadius: DISC / 2,
              border: "4px solid #97865F",
              background: "#F0E5CB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={INNER} height={INNER} viewBox={`0 0 ${INNER} ${INNER}`}>
              {wedges.map((hex, i) => (
                <path key={hex} d={wedgePath(i, wedges.length)} fill={hex} />
              ))}
            </svg>
          </div>
        ) : (
          <div
            style={{
              width: DISC,
              height: DISC,
              borderRadius: DISC / 2,
              border: "4px solid #97865F",
              background: card.swatch ?? "#F0E5CB",
              display: "flex",
            }}
          />
        )}
        <div style={{ display: "flex", fontSize: 34, color: "#6A5F4C" }}>{card.eyebrow}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: titleSize, fontWeight: 700, color: "#2E2A23", lineHeight: 1.05, letterSpacing: -1 }}>
          {card.title}
        </div>
        <div style={{ display: "flex", width: 132, height: 8, borderRadius: 4, background: "#1E4634" }} />
        <div style={{ display: "flex", fontSize: 40, color: "#4A4438" }}>{card.subtitle}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* The theme's stem-and-two-leaves divider, as shapes (same geometry as /theme/divider-stem.svg). */}
        <svg width="440" height="48" viewBox="0 0 220 24" fill="none">
          <path d="M4 12 H84" stroke="#4A4438" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          <path d="M136 12 H216" stroke="#4A4438" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          <path d="M110 21 C110 14 110 8 110 3" stroke="#4A4438" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
          <path d="M110 13 C103 12 98 8 97 2 C103 3 108 6 110 13 Z" fill="#7D9B76" opacity="0.85" />
          <path d="M110 13 C117 12 122 8 123 2 C117 3 112 6 110 13 Z" fill="#7D9B76" opacity="0.85" />
          <circle cx="110" cy="16.5" r="1.8" fill="#8E2A52" opacity="0.8" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30 }}>
          <div style={{ display: "flex", color: "#8E2A52", fontWeight: 700 }}>{card.footer}</div>
          <div style={{ display: "flex", color: "#6A5F4C" }}>Source + date on every listing · No checkout</div>
        </div>
      </div>
    </div>
  );
}
