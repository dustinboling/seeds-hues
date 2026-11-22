/**
 * Decision feedback (spec §10.4): every decision resolves to this role="status" line. Shared
 * by Review and Sellers — any status object with text (+ an optional deep link) renders.
 */
export function StatusBanner({ status }: { status: { kind?: string; text: string; href?: string; hrefLabel?: string } }) {
  return (
    <p role="status" className="rounded-field bg-leaf-50 p-3 font-sans text-[15px] text-ink">
      {status.text}{" "}
      {status.href ? (
        <a href={status.href} className="font-semibold text-link underline">
          {status.hrefLabel ?? "Open"}
        </a>
      ) : null}
    </p>
  );
}
