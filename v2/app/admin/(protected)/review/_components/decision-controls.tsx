"use client";

/**
 * Queue decision controls (client islands): reason sheets (§10.3 — reasons live inside
 * their pop-ups, never as open forms), the §10.1 destructive confirms, and the C4 inline
 * consequence panels (the comparison stays visible — never a modal). All state changes in
 * event handlers only; the decisions themselves are native form posts.
 */
import { useRef, useState } from "react";
import { Sheet } from "@/components/admin/Sheet";

function Hidden({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/**
 * A secondary button opening a reason sheet around a decision post. `reasons` selects the
 * C3/C5 select shape (optional select + optional note); without it the C2 text shape.
 */
export function SheetReasonButton({
  buttonLabel,
  sheetTitle,
  fields,
  reasons,
  submitLabel,
  consequence,
  danger,
  hideReason,
}: {
  buttonLabel: string;
  sheetTitle: string;
  fields: Record<string, string>;
  reasons?: readonly string[];
  submitLabel: string;
  consequence?: string;
  danger?: boolean;
  /** The removal confirm: consequence only, no reason field. */
  hideReason?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open ? (
        <Sheet title={sheetTitle} onClose={() => setOpen(false)} initialFocusRef={danger ? cancelRef : undefined}>
          <form method="post" action="/admin/review/decide" className="flex flex-col gap-3">
            <Hidden fields={fields} />
            {consequence ? <p className="font-sans text-base">{consequence}</p> : null}
            {hideReason ? null : reasons ? (
              <>
                <p>
                  <label htmlFor={`reason-select-${sheetTitle}`} className="mb-1 block font-sans text-sm font-semibold">
                    Reason (optional)
                  </label>
                  <select id={`reason-select-${sheetTitle}`} name="reason_select" defaultValue="" className="field w-full">
                    <option value="">Choose a reason</option>
                    {reasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </p>
                <p>
                  <label htmlFor={`reason-note-${sheetTitle}`} className="mb-1 block font-sans text-sm font-semibold">
                    Note (optional)
                  </label>
                  <input id={`reason-note-${sheetTitle}`} name="reason_note" type="text" maxLength={500} autoComplete="off" className="field w-full" />
                </p>
              </>
            ) : (
              <p>
                <label htmlFor={`reason-${sheetTitle}`} className="mb-1 block font-sans text-sm font-semibold">
                  Reason (optional)
                </label>
                <input id={`reason-${sheetTitle}`} name="reason" type="text" maxLength={500} autoComplete="off" className="field w-full" />
              </p>
            )}
            <div className="flex flex-col gap-2 min-[744px]:flex-row">
              <button ref={danger ? cancelRef : undefined} type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={danger ? "btn btn-danger" : "btn btn-primary"}>
                {submitLabel}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

/**
 * The C4 duplicate choice: two equal-weight secondary buttons; tapping either expands its
 * consequence inline (never a modal) with Back + the primary-weight confirm.
 */
export function DuplicateChoice({ held, existing, baseFields }: { held: string; existing: string; baseFields: Record<string, string> }) {
  const [choice, setChoice] = useState<"duplicate" | "not_duplicate" | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 min-[744px]:flex-row">
        <button type="button" className="btn btn-secondary" aria-expanded={choice === "duplicate"} onClick={() => setChoice(choice === "duplicate" ? null : "duplicate")}>
          It&apos;s a duplicate
        </button>
        <button type="button" className="btn btn-secondary" aria-expanded={choice === "not_duplicate"} onClick={() => setChoice(choice === "not_duplicate" ? null : "not_duplicate")}>
          Not a duplicate
        </button>
      </div>
      {choice === "duplicate" ? (
        <div className="rounded-[12px] border border-line-strong bg-paper-deep p-4">
          <p className="font-sans text-base">
            &apos;{held}&apos; will be kept as another name for &apos;{existing}&apos;. It will still turn up in search, its listings move to that variety, and the scout
            won&apos;t propose it again.
          </p>
          <form method="post" action="/admin/review/decide" className="mt-3 flex flex-col gap-2 min-[744px]:flex-row">
            <Hidden fields={{ ...baseFields, action: "mark_duplicate" }} />
            <button type="button" className="btn btn-secondary" onClick={() => setChoice(null)}>
              Back
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm: mark as duplicate
            </button>
          </form>
        </div>
      ) : null}
      {choice === "not_duplicate" ? (
        <div className="rounded-[12px] border border-line-strong bg-paper-deep p-4">
          <p className="font-sans text-base">
            &apos;{held}&apos; will be added as its own variety, with its listings. It gets its own public page.
          </p>
          <form method="post" action="/admin/review/decide" className="mt-3 flex flex-col gap-2 min-[744px]:flex-row">
            <Hidden fields={{ ...baseFields, action: "add_hold_variety" }} />
            <button type="button" className="btn btn-secondary" onClick={() => setChoice(null)}>
              Back
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm: add the variety
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
