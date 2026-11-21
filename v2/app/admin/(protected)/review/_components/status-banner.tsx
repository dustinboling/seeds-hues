/** Decision feedback (spec §10.4): every decision resolves to this role="status" line. */
import type { StatusLine } from "@/lib/admin/review-queues";

export function StatusBanner({ status }: { status: StatusLine }) {
  return (
    <p role="status" className="rounded-[10px] bg-leaf-50 p-3 font-sans text-[15px] text-ink">
      {status.text}{" "}
      {status.href ? (
        <a href={status.href} className="font-semibold text-link underline">
          {status.hrefLabel ?? "Open"}
        </a>
      ) : null}
    </p>
  );
}
