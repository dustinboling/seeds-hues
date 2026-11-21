/**
 * Dashboard stats snapshot band in its composed form (spec §7B). The statistics wiring is
 * Slice D — every card renders the designed no-data state rather than an invented number.
 */
const CARDS = [
  { label: "Visitors", caption: "No visits recorded yet — stats begin with the first full day." },
  { label: "New accounts", caption: "No account stats yet — they begin with the first full day." },
  { label: "Waitlist signups", caption: "No waitlist stats yet — they begin with the first full day." },
  { label: "Clicks to sellers", caption: "No click stats yet — they begin with the first full day." },
] as const;

export function StatsSnapshot() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[744px]:grid-cols-2 min-[1024px]:grid-cols-4">
      {CARDS.map((c) => (
        <div key={c.label} className="card flex flex-col gap-1 p-4 min-[744px]:p-5">
          <p className="font-sans text-base font-semibold">{c.label}</p>
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">{c.caption}</p>
        </div>
      ))}
    </div>
  );
}
