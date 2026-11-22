"use client";

/**
 * Varieties client islands (Slice C): the add-name sheet (one field + consequence line),
 * the manual-alias remove confirm, and the variety-remove confirm. All state changes in
 * event handlers only. The add-name save posts via fetch and navigates to the server's
 * redirect on success (on failure the sheet stays open with values intact and the §10.2
 * error at its head); the confirms submit native forms.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sheet } from "@/components/admin/Sheet";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ADD_ALIAS_CONSEQUENCE, REMOVE_ALIAS_CONSEQUENCE, varietyRemoveConsequence } from "@/lib/admin/varieties";

export interface VarietyCtx {
  variety: string;
  tab: string;
  q: string | null;
  crop: string | null;
  show: string;
}

interface FieldError {
  field: string;
  message: string;
}

function HiddenCtx({ ctx, action, extra }: { ctx: VarietyCtx; action: string; extra?: { name: string; value: string }[] }) {
  return (
    <>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="variety" value={ctx.variety} />
      {ctx.tab !== "varieties" ? <input type="hidden" name="tab" value={ctx.tab} /> : null}
      {ctx.q ? <input type="hidden" name="q" value={ctx.q} /> : null}
      {ctx.crop ? <input type="hidden" name="crop" value={ctx.crop} /> : null}
      {ctx.show !== "50" ? <input type="hidden" name="show" value={ctx.show} /> : null}
      {(extra ?? []).map((e) => (
        <input key={e.name} type="hidden" name={e.name} value={e.value} />
      ))}
    </>
  );
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

// ─── Add another name ─────────────────────────────────────────────────────────

function fieldErrorFor(errors: FieldError[], field: string): string | null {
  return errors.find((e) => e.field === field)?.message ?? null;
}

/** The add-name form: one field + the consequence line. Exported for tests. */
export function AddAliasForm({ ctx }: { ctx: VarietyCtx }) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) {
      if (errors.length >= 2 || errors[0]!.field === "form") errorRef.current?.focus();
      else document.getElementById("alias-name")?.focus();
    }
  }, [errors]);

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
    setErrors(r.errors);
    setBusy(false);
  }

  const formError = fieldErrorFor(errors, "form");
  const nameError = fieldErrorFor(errors, "name");
  return (
    <form ref={formRef} method="post" action="/admin/varieties/actions" noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      <HiddenCtx ctx={ctx} action="alias_add" />
      {formError ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-control border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{formError}</span>
          </p>
        </div>
      ) : null}
      <p>
        <label htmlFor="alias-name" className="mb-1 block font-sans text-sm font-semibold">
          Another name
        </label>
        <input
          id="alias-name"
          name="name"
          type="text"
          maxLength={200}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "alias-name-error" : undefined}
          className="field min-h-target w-full"
        />
        {nameError ? (
          <span id="alias-name-error" className="mt-1 flex items-start gap-1.5 font-sans text-sm text-warn">
            <ErrorIcon />
            <span>{nameError}</span>
          </span>
        ) : null}
      </p>
      <p className="font-sans text-[15px] text-ink-soft">{ADD_ALIAS_CONSEQUENCE}</p>
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 py-3 admin:-mx-6 admin:px-6">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add name"}
        </button>
      </div>
    </form>
  );
}

/** F2's Add another name button + sheet (Admin only — the button is absent for Reviewer). */
export function AddAliasButton({ ctx }: { ctx: VarietyCtx }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Add another name
      </button>
      {open ? (
        <Sheet title="Add another name" onClose={() => setOpen(false)}>
          <AddAliasForm ctx={ctx} />
        </Sheet>
      ) : null}
    </>
  );
}

// ─── Remove a manually added name ─────────────────────────────────────────────

/**
 * A manual alias's remove control + §10.1 confirm (Admin only; never rendered for
 * decision aliases — absent for both roles). The confirm names the full consequence.
 */
export function RemoveAliasButton({ alias, ctx }: { alias: string; ctx: VarietyCtx }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary min-h-target" disabled={busy} onClick={() => setOpen(true)} aria-label={`Remove the name '${alias}'`}>
        Remove
      </button>
      <form ref={formRef} method="post" action="/admin/varieties/actions" className="hidden" aria-hidden="true" tabIndex={-1}>
        <HiddenCtx ctx={ctx} action="alias_remove" extra={[{ name: "alias", value: alias }]} />
      </form>
      {open ? (
        <ConfirmDialog
          title={`Remove '${alias}'?`}
          consequence={REMOVE_ALIAS_CONSEQUENCE}
          verb="Remove name"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setBusy(true);
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
    </>
  );
}

// ─── Remove variety ───────────────────────────────────────────────────────────

/** The danger-zone Remove button + §10.1 confirm (Admin only, at zero live listings). */
export function RemoveVarietyButton({ varietyName, ctx }: { varietyName: string; ctx: VarietyCtx }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(true)}>
        Remove variety
      </button>
      <form ref={formRef} method="post" action="/admin/varieties/actions" className="hidden" aria-hidden="true" tabIndex={-1}>
        <HiddenCtx ctx={ctx} action="variety_remove" />
      </form>
      {open ? (
        <ConfirmDialog
          title={`Remove '${varietyName}'?`}
          consequence={varietyRemoveConsequence(varietyName)}
          verb="Remove variety"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setBusy(true);
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
    </>
  );
}
