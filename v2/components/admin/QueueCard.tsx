/**
 * Dashboard queue card (spec §7B): queue name, the waiting count as a stat number, one line
 * naming what waits, the oldest item's age — the whole card is the tap target. The zero
 * state is designed, not empty: "All clear" in place of the number, same anatomy.
 */
export function QueueCard({ name, description, count, oldest, href }: { name: string; description: string; count: number; oldest: string | null; href: string }) {
  const clear = count === 0;
  return (
    <a href={href} className="card flex flex-col gap-1 p-4 min-[744px]:p-5">
      <span className="font-sans text-base font-semibold">{name}</span>
      {clear ? (
        <span className="font-sans text-[32px] font-semibold leading-[1.1] text-leaf">All clear</span>
      ) : (
        <span className="font-sans text-[32px] font-semibold leading-[1.1] tabular-nums">{count}</span>
      )}
      <span className="font-sans text-sm text-ink-soft">{description}</span>
      {clear || !oldest ? null : <span className="font-sans text-[13px] text-muted">{oldest}</span>}
    </a>
  );
}
