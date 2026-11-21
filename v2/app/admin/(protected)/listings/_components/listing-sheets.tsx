"use client";

/**
 * Listings client islands (Slice C): the E2 retire confirm with the reason select inside
 * it (resolution 8 — never an open form on the page). All state changes in event handlers
 * only; the save posts via fetch and navigates to the server's redirect on success (fresh
 * server data + the status line); on failure the dialog stays open with values intact and
 * the §10.2 error at its head.
 */
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Sheet } from "@/components/admin/Sheet";
import { RETIRE_REASONS, retireConsequence } from "@/lib/admin/listings";

export interface ListingCtx {
  listing: string;
  q: string | null;
  chip: string;
  seller: string | null;
  variety: string | null;
  show: string;
}

interface FieldError {
  field: string;
  message: string;
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" className="mt-0.5 size-4 shrink-0">
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2c-.5 0-.9.4-.9.9v3.1c0 .5.4.9.9.9s.9-.4.9-.9V6.6c0-.5-.4-.9-.9-.9Zm0 6.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}

async function postSheet(form: HTMLFormElement): Promise<{ ok: true; redirect: string } | { ok: false; errors: FieldError[]; message: string }> {
  let res: Response;
  try {
    res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, errors: [{ field: "form", message: "That didn't go through. Check your connection and try again — nothing was changed." }], message: "connection" };
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: unknown; errors?: unknown; message?: unknown } | null;
  if (res.ok && body?.ok === true && typeof body.redirect === "string") return { ok: true, redirect: body.redirect };
  const errors = Array.isArray(body?.errors)
    ? (body.errors as { field?: unknown; message?: unknown }[]).map((e) => ({ field: typeof e.field === "string" ? e.field : "form", message: typeof e.message === "string" ? e.message : "That didn't go through." }))
    : [];
  const message = typeof body?.message === "string" ? body.message : "That didn't go through. Nothing was changed — try again.";
  return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message }], message };
}

/** The retire form: consequence, reason select, optional note, safe-first buttons. Exported for tests. */
export function RetireForm({ listingId, varietyName, ctx, onClose, cancelRef }: { listingId: number; varietyName: string; ctx: ListingCtx; onClose: () => void; cancelRef?: RefObject<HTMLButtonElement | null> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fallbackCancelRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form || busy) return;
    setBusy(true);
    const r = await postSheet(form);
    if (r.ok) {
      window.location.assign(r.redirect);
      return;
    }
    setError(r.errors.find((x) => x.field === "form")?.message ?? r.errors[0]?.message ?? "That didn't go through.");
    setBusy(false);
  }

  return (
    <form ref={formRef} method="post" action="/admin/listings/actions" onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="action" value="retire" />
      <input type="hidden" name="listing" value={listingId} />
      {ctx.q ? <input type="hidden" name="q" value={ctx.q} /> : null}
      {ctx.chip !== "all" ? <input type="hidden" name="chip" value={ctx.chip} /> : null}
      {ctx.seller ? <input type="hidden" name="seller" value={ctx.seller} /> : null}
      {ctx.variety ? <input type="hidden" name="variety" value={ctx.variety} /> : null}
      {ctx.show !== "50" ? <input type="hidden" name="show" value={ctx.show} /> : null}
      <p className="font-sans text-base">{retireConsequence(varietyName)}</p>
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-[12px] border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{error}</span>
          </p>
        </div>
      ) : null}
      <p>
        <label htmlFor="retire-reason" className="mb-1 block font-sans text-sm font-semibold">
          Reason
        </label>
        <select id="retire-reason" name="reason" defaultValue="" required disabled={busy} className="field min-h-[44px] w-full">
          <option value="" disabled>
            Choose a reason
          </option>
          {RETIRE_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </p>
      <p>
        <label htmlFor="retire-note" className="mb-1 block font-sans text-sm font-semibold">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="retire-note" name="note" type="text" maxLength={500} autoComplete="off" disabled={busy} className="field min-h-[44px] w-full" />
      </p>
      <div className="flex flex-col gap-2 min-[744px]:flex-row">
        <button ref={cancelRef ?? fallbackCancelRef} type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-danger" disabled={busy}>
          {busy ? "Retiring…" : "Retire listing"}
        </button>
      </div>
    </form>
  );
}

/** E2's Retire button + the §10.1 confirm (Admin only — the button is absent for Reviewer). */
export function RetireButton({ listingId, varietyName, ctx }: { listingId: number; varietyName: string; ctx: ListingCtx }) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Retire listing
      </button>
      {open ? (
        <Sheet title="Retire this listing?" onClose={() => setOpen(false)} initialFocusRef={cancelRef}>
          <RetireForm listingId={listingId} varietyName={varietyName} ctx={ctx} onClose={() => setOpen(false)} cancelRef={cancelRef} />
        </Sheet>
      ) : null}
    </>
  );
}
