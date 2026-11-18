/**
 * Decorative horizontal seed-pod scene (a 1600×400 /ornaments/bundle-<key>.webp from
 * lib/data/pod-ornaments.ts) used as a section divider. aria-hidden, empty alt, no caption.
 */
export function PodDivider({ bundle, className }: { bundle: string; className?: string }) {
  return (
    <div aria-hidden="true" data-testid="pod-divider" className={["w-full", className].filter(Boolean).join(" ")}>
      {/* A plain <img>: the files are fixed-size local assets, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bundle} alt="" width={1600} height={400} loading="lazy" decoding="async" className="h-auto w-full" />
    </div>
  );
}
