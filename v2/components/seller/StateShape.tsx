import { STATE_SHAPES } from "@/lib/data/state-paths";
import { imageUrl } from "@/lib/images";

/**
 * A US state outline (decorative). Fill leaf-deep at 8%, leaf-deep hairline stroke that keeps its
 * width at any size. The state name must always be printed beside it as text: the shape is
 * aria-hidden and never carries the information alone. Unknown region → renders nothing.
 * The outline is centred in a size × size square, so icons line up whatever the state's aspect.
 * `art` (opt-in, for the large state-page header): the state-flower artwork (stored path
 * /artwork/states/{slug}.webp, rendered through lib/images as an 800-wide scale-down
 * transformation from our own image CDN) is clipped to the outline (clip id derived from the state
 * code, so SSR output is deterministic) and the same hairline outline is drawn over it. Still
 * decorative. The transformation never crops; the browser-side "slice" fill + outline clip is the
 * design.
 */
export function StateShape({
  region,
  size = 20,
  className = "",
  art = false,
}: {
  /** USPS state code (= seller.region), any case. */
  region: string | null | undefined;
  /** Square box in px. */
  size?: number;
  className?: string;
  /** Fill the outline with the state's flower artwork instead of the 8% tint. */
  art?: boolean;
}) {
  const shape = region ? STATE_SHAPES[region.trim().toUpperCase()] : undefined;
  if (!shape) return null;
  if (art) {
    const [, , w, h] = shape.viewBox.trim().split(/\s+/).map(Number);
    const clipId = `state-art-clip-${shape.code}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox={shape.viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        data-state-shape={shape.code}
        className={`shrink-0 overflow-visible stroke-leaf ${className}`.trim()}
      >
        <defs>
          <clipPath id={clipId}>
            {shape.paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </clipPath>
        </defs>
        <image
          href={imageUrl(`/artwork/states/${shape.slug}.webp`, { width: 800 })}
          x={0}
          y={0}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
        {shape.paths.map((d, i) => (
          <path key={i} d={d} fill="none" strokeWidth={size >= 80 ? 1.75 : 1.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={shape.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-state-shape={shape.code}
      className={`shrink-0 overflow-visible fill-leaf/8 stroke-leaf ${className}`.trim()}
    >
      {shape.paths.map((d, i) => (
        <path key={i} d={d} strokeWidth={size >= 80 ? 1.75 : 1.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
