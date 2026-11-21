/**
 * F3 crops (Slice C): orientation only within the Varieties section — crop name, variety
 * count, seller count. Tapping a crop filters F1 to it. No crop editing exists.
 */
import { varietyHref } from "./urls";

export interface CropListRow {
  slug: string;
  commonName: string;
  varietyCount: number;
  sellerCount: number;
}

export function CropList({ rows }: { rows: CropListRow[] }) {
  if (rows.length === 0) return <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No crops in the directory yet.</p>;
  return (
    <ol className="flex min-w-0 flex-col">
      {rows.map((r) => (
        <li key={r.slug}>
          <a
            href={varietyHref({ crop: r.slug })}
            className="block rounded-[12px] border-b border-line px-3 py-3 font-sans last:border-b-0 hover:bg-paper-deep"
          >
            <span className="block text-base font-semibold">{r.commonName}</span>
            <span className="mt-0.5 block text-sm tabular-nums text-muted">
              {r.varietyCount === 1 ? "1 variety" : `${r.varietyCount.toLocaleString("en-US")} varieties`} · {r.sellerCount === 1 ? "1 seller" : `${r.sellerCount.toLocaleString("en-US")} sellers`}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
