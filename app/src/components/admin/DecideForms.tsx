import { useRef, useState } from "react";
import { callAdmin } from "./api";
import { Sheet } from "./Sheet";

/**
 * Queue decision controls — ported from v2's decision-controls: reason
 * sheets (§10.3 — reasons live inside their pop-ups, never as open
 * forms) and the C4 duplicate choice (two equal-weight buttons, inline
 * consequence panels, never a modal). Native POST forms enhanced with
 * fetch: success follows the handler's redirect, failure renders the
 * message with values preserved. Only submit buttons ever busy.
 */
type Ctx = Record<string, string>;

function Hidden({ fields }: { fields: Record<string, string | number> }) {
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
    </>
  );
}

function useSubmit(action: string, onDone: (r: { redirect: string }) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (fields: Record<string, unknown>): void => {
    setBusy(true);
    setError(null);
    void callAdmin(action, fields).then((r) => {
      setBusy(false);
      if (r.ok) onDone({ redirect: r.redirect });
      else setError(r.message);
    });
  };
  return { busy, error, submit };
}

export function DecideForm({
  action,
  kind,
  id,
  ctx,
  submitLabel,
  busyLabel,
  onDone,
}: {
  action: string;
  kind: string;
  id: number;
  ctx: Ctx;
  submitLabel: string;
  busyLabel?: string;
  onDone: (r: { redirect: string }) => void;
}) {
  const { busy, error, submit } = useSubmit("/admin/review/decide", onDone);
  return (
    <form
      method="post"
      action="/admin/review/decide"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit({ action, kind, id, ...ctx });
      }}
    >
      <Hidden fields={{ action, kind, id, ...ctx }} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy ? (busyLabel ?? "Working…") : submitLabel}
      </button>
    </form>
  );
}

/**
 * A secondary button opening a reason sheet around a decision post.
 * `reasons` selects the C3/C5 select shape (optional select + optional
 * note); without it the C2 text shape (one optional reason input).
 */
export function ReasonDecideForm({
  action,
  kind,
  id,
  ctx,
  reasons,
  buttonLabel,
  sheetTitle,
  submitLabel,
  consequence,
  danger,
  hideReason,
  onDone,
}: {
  action: string;
  kind: string;
  id: number;
  ctx: Ctx;
  reasons?: readonly string[];
  buttonLabel: string;
  sheetTitle: string;
  submitLabel: string;
  consequence?: string;
  danger?: boolean;
  hideReason?: boolean;
  onDone?: (r: { redirect: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const done = onDone ?? (() => {});
  const { busy, error, submit } = useSubmit("/admin/review/decide", done);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open ? (
        <Sheet title={sheetTitle} onClose={() => setOpen(false)} initialFocusRef={danger ? cancelRef : undefined}>
          <form
            method="post"
            action="/admin/review/decide"
            aria-busy={busy || undefined}
            className="admin-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const fields: Record<string, unknown> = { action, kind, id, ...ctx };
              if (!hideReason) {
                if (reasons) {
                  fields.reason_select = String(data.get("reason_select") ?? "");
                  fields.reason_note = String(data.get("reason_note") ?? "");
                } else {
                  fields.reason = String(data.get("reason") ?? "");
                }
              }
              submit(fields);
            }}
          >
            <Hidden fields={{ action, kind, id, ...ctx }} />
            {consequence ? <p className="admin-prose">{consequence}</p> : null}
            {error ? (
              <p role="alert" className="admin-alert">
                {error}
              </p>
            ) : null}
            {hideReason ? null : reasons ? (
              <>
                <p>
                  <label htmlFor={`reason-select-${sheetTitle}`} className="admin-label">
                    Reason (optional)
                  </label>
                  <select id={`reason-select-${sheetTitle}`} name="reason_select" defaultValue="" className="field">
                    <option value="">Choose a reason</option>
                    {reasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </p>
                <p>
                  <label htmlFor={`reason-note-${sheetTitle}`} className="admin-label">
                    Note (optional)
                  </label>
                  <input id={`reason-note-${sheetTitle}`} name="reason_note" type="text" maxLength={500} autoComplete="off" className="field" />
                </p>
              </>
            ) : (
              <p>
                <label htmlFor={`reason-${sheetTitle}`} className="admin-label">
                  Reason (optional)
                </label>
                <input id={`reason-${sheetTitle}`} name="reason" type="text" maxLength={500} autoComplete="off" className="field" />
              </p>
            )}
            <div className="admin-row">
              <button ref={danger ? cancelRef : undefined} type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={danger ? "btn btn-danger" : "btn btn-primary"}>
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
 * The C4 duplicate choice: two equal-weight secondary buttons; tapping
 * either expands its consequence inline (never a modal) with Back + the
 * confirm. Plus Skip for now (records seen, never decided).
 */
export function DuplicateDecideForm({ id, held, existing, ctx, onDone }: { id: number; held: string; existing: string; ctx: Ctx; onDone: (r: { redirect: string }) => void }) {
  const [choice, setChoice] = useState<"duplicate" | "not_duplicate" | null>(null);
  const { busy, error, submit } = useSubmit("/admin/review/decide", onDone);
  const base = { kind: "review", id, ...ctx };
  return (
    <div className="admin-stack">
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      <div className="admin-row">
        <button type="button" className="btn btn-secondary" aria-expanded={choice === "duplicate"} onClick={() => setChoice(choice === "duplicate" ? null : "duplicate")}>
          It&apos;s a duplicate
        </button>
        <button type="button" className="btn btn-secondary" aria-expanded={choice === "not_duplicate"} onClick={() => setChoice(choice === "not_duplicate" ? null : "not_duplicate")}>
          Not a duplicate
        </button>
      </div>
      {choice === "duplicate" ? (
        <div className="admin-panel">
          <p className="admin-prose">
            &lsquo;{held}&rsquo; will be kept as another name for &lsquo;{existing}&rsquo;. It will still turn up in search, its listings move to that variety, and the scout
            won&rsquo;t propose it again.
          </p>
          <form
            method="post"
            action="/admin/review/decide"
            className="admin-row"
            onSubmit={(event) => {
              event.preventDefault();
              submit({ ...base, action: "mark_duplicate" });
            }}
          >
            <Hidden fields={{ ...base, action: "mark_duplicate" }} />
            <button type="button" className="btn btn-secondary" onClick={() => setChoice(null)}>
              Back
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary">
              Confirm: mark as duplicate
            </button>
          </form>
        </div>
      ) : null}
      {choice === "not_duplicate" ? (
        <div className="admin-panel">
          <p className="admin-prose">&lsquo;{held}&rsquo; will be added as its own variety, with its listings. It gets its own public page.</p>
          <form
            method="post"
            action="/admin/review/decide"
            className="admin-row"
            onSubmit={(event) => {
              event.preventDefault();
              submit({ ...base, action: "add_hold_variety" });
            }}
          >
            <Hidden fields={{ ...base, action: "add_hold_variety" }} />
            <button type="button" className="btn btn-secondary" onClick={() => setChoice(null)}>
              Back
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary">
              Confirm: add the variety
            </button>
          </form>
        </div>
      ) : null}
      <form
        method="post"
        action="/admin/review/decide"
        onSubmit={(event) => {
          event.preventDefault();
          submit({ ...base, action: "skip_hold" });
        }}
      >
        <Hidden fields={{ ...base, action: "skip_hold" }} />
        <button type="submit" disabled={busy} className="link-button">
          Skip for now
        </button>
      </form>
    </div>
  );
}
