"use client";

/**
 * Sellers client islands (Slice B): the D3 edit sheet, the D4 classification sheet, the D5
 * note composer, and the danger-zone confirms. All state changes in event handlers only;
 * saves post via fetch and navigate to the server's redirect on success (fresh server data
 * + the status line); on failure the sheet stays open with values intact and the §10.2
 * error at its head (optimistic with honest reversal, §10.5).
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/admin/Sheet";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SELLER_FIELD_LABELS, formatShipsTo, type SellerUpdateField } from "@/lib/admin/sellers";

export interface SellerCtx {
  seller: string;
  q: string | null;
  badge: string;
  state: string;
  sort: string;
}

export interface SellerEditDefaults {
  slug: string;
  name: string;
  type: string;
  platform: string | null;
  homepage: string | null;
  contactEmail: string | null;
  location: string | null;
  region: string | null;
  country: string;
  shipsTo: string;
  description: string | null;
  orderingNotes: string | null;
}

interface FieldError {
  field: string;
  message: string;
}

function HiddenCtx({ ctx }: { ctx: SellerCtx }) {
  return (
    <>
      <input type="hidden" name="seller" value={ctx.seller} />
      {ctx.q ? <input type="hidden" name="q" value={ctx.q} /> : null}
      {ctx.badge !== "all" ? <input type="hidden" name="badge" value={ctx.badge} /> : null}
      {ctx.state !== "all" ? <input type="hidden" name="state" value={ctx.state} /> : null}
      {ctx.sort !== "name" ? <input type="hidden" name="sort" value={ctx.sort} /> : null}
    </>
  );
}

function fieldErrorFor(errors: FieldError[], field: string): string | null {
  return errors.find((e) => e.field === field)?.message ?? null;
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" className="mt-0.5 size-4 shrink-0">
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2c-.5 0-.9.4-.9.9v3.1c0 .5.4.9.9.9s.9-.4.9-.9V6.6c0-.5-.4-.9-.9-.9Zm0 6.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}

/** Inline field error: ochre + icon + words, wired to its field. */
function FieldErrorLine({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1 flex items-start gap-1.5 font-sans text-sm text-warn">
      <ErrorIcon />
      <span>{message}</span>
    </p>
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

// ─── D3 — Edit seller ────────────────────────────────────────────────────────

const EDIT_GROUPS: { title: string; fields: SellerUpdateField[] }[] = [
  { title: "Identity", fields: ["name", "type", "platform"] },
  { title: "Contact & links", fields: ["homepage", "contactEmail"] },
  { title: "Location", fields: ["location", "region", "country", "shipsTo"] },
  { title: "About", fields: ["description", "orderingNotes"] },
];

const EDIT_LABELS: Record<SellerUpdateField, string> = { ...SELLER_FIELD_LABELS, homepage: "Website", shipsTo: "Ships to" };

function defaultFor(seller: SellerEditDefaults, field: SellerUpdateField): string {
  switch (field) {
    case "name":
      return seller.name;
    case "type":
      return seller.type;
    case "platform":
      return seller.platform ?? "";
    case "homepage":
      return seller.homepage ?? "";
    case "contactEmail":
      return seller.contactEmail ?? "";
    case "location":
      return seller.location ?? "";
    case "region":
      return seller.region ?? "";
    case "country":
      return seller.country;
    case "shipsTo":
      return formatShipsTo(seller.shipsTo);
    case "description":
      return seller.description ?? "";
    case "orderingNotes":
      return seller.orderingNotes ?? "";
  }
}

function EditField({
  field,
  seller,
  typeOptions,
  platformOptions,
  error,
}: {
  field: SellerUpdateField;
  seller: SellerEditDefaults;
  typeOptions: { value: string; label: string }[];
  platformOptions: { value: string; label: string }[];
  error: string | null;
}) {
  const id = `edit-${field}`;
  const errorId = `${id}-error`;
  const described = field === "shipsTo" ? `${id}-hint${error ? ` ${errorId}` : ""}` : error ? errorId : undefined;
  const inputClass = "field min-h-target w-full";
  const label = (
    <label htmlFor={id} className="mb-1 block font-sans text-sm font-semibold">
      {EDIT_LABELS[field]}
    </label>
  );
  let control: ReactNode;
  if (field === "type") {
    control = (
      <select id={id} name={field} defaultValue={defaultFor(seller, field)} aria-invalid={error ? true : undefined} aria-describedby={described} className={inputClass}>
        {typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field === "platform") {
    control = (
      <select id={id} name={field} defaultValue={defaultFor(seller, field)} aria-invalid={error ? true : undefined} aria-describedby={described} className={inputClass}>
        <option value="">None</option>
        {platformOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field === "description" || field === "orderingNotes") {
    control = <textarea id={id} name={field} defaultValue={defaultFor(seller, field)} rows={4} maxLength={2000} aria-invalid={error ? true : undefined} aria-describedby={described} className={`${inputClass} min-h-[88px]`} />;
  } else {
    const props =
      field === "name"
        ? { maxLength: 200 }
        : field === "homepage"
          ? { maxLength: 2000, inputMode: "url" as const }
          : field === "contactEmail"
            ? { maxLength: 320, inputMode: "email" as const }
            : field === "location"
              ? { maxLength: 200 }
              : field === "region"
                ? { maxLength: 10 }
                : field === "country"
                  ? { maxLength: 80 }
                  : { maxLength: 400 };
    control = (
      <input
        id={id}
        name={field}
        type="text"
        defaultValue={defaultFor(seller, field)}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        aria-required={field === "name" || field === "country" ? true : undefined}
        className={inputClass}
        {...props}
      />
    );
  }
  return (
    <p>
      {label}
      {control}
      {field === "shipsTo" ? (
        <span id={`${id}-hint`} className="mt-1 block font-sans text-sm text-muted">
          Comma-separated region codes. Leave blank if unknown.
        </span>
      ) : null}
      {error ? <FieldErrorLine id={errorId} message={error} /> : null}
    </p>
  );
}

/** The D3 form: fields grouped, sticky save bar, server-driven validation. Exported for tests. */
export function EditSellerForm({
  seller,
  typeOptions,
  platformOptions,
  ctx,
  onClose,
  onDiscardRequest,
}: {
  seller: SellerEditDefaults;
  typeOptions: { value: string; label: string }[];
  platformOptions: { value: string; label: string }[];
  ctx: SellerCtx;
  /** Clean cancel — close outright. */
  onClose: () => void;
  /** Dirty cancel — open the "Discard your changes?" confirm. */
  onDiscardRequest: () => void;
}) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Failed saves move focus to the summary (2+ errors) or the one invalid field — refs
  // only, no state writes in the effect body.
  useEffect(() => {
    if (errors.length === 0) return;
    if (errors.length >= 2 || errors[0]!.field === "form") summaryRef.current?.focus();
    else document.getElementById(`edit-${errors[0]!.field}`)?.focus();
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

  function currentOf(form: HTMLFormElement, field: SellerUpdateField): string {
    const data = new FormData(form);
    return (data.get(field) ?? "").toString();
  }

  function onCancelClick() {
    const form = formRef.current;
    // Unchanged → close outright; edited → the "Discard your changes?" confirm.
    if (form && EDIT_GROUPS.some((g) => g.fields.some((f) => currentOf(form, f) !== defaultFor(seller, f)))) onDiscardRequest();
    else onClose();
  }

  const formError = fieldErrorFor(errors, "form");
  const showSummary = formError !== null || errors.length >= 2;
  return (
    <form ref={formRef} method="post" action="/admin/sellers/actions" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="action" value="edit_save" />
      <HiddenCtx ctx={ctx} />
      {showSummary ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" aria-label="Save problems" className="rounded-control border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{formError ?? "Some fields need attention before saving."}</span>
          </p>
          {errors.length >= 2 ? (
            <ul className="mt-2 flex flex-col gap-1 font-sans text-[15px]">
              {errors
                .filter((e) => e.field !== "form")
                .map((e) => (
                  <li key={e.field}>
                    <a href={`#edit-${e.field}`} className="text-link underline">
                      {(SELLER_FIELD_LABELS[e.field as SellerUpdateField] ?? e.field) + ": " + e.message}
                    </a>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {EDIT_GROUPS.map((g) => (
        <fieldset key={g.title} className="flex flex-col gap-3">
          <legend className="mb-1 font-sans text-sm font-bold uppercase tracking-[0.09em] text-muted">{g.title}</legend>
          {g.title === "Identity" ? (
            <p>
              <span className="mb-1 block font-sans text-sm font-semibold">Web address</span>
              <span className="block font-sans text-[15px] text-ink-soft">/seller/{seller.slug}</span>
              <span className="mt-1 block font-sans text-sm text-muted">The web address doesn&apos;t change, so links keep working.</span>
            </p>
          ) : null}
          {g.fields.map((f) => (
            <EditField key={f} field={f} seller={seller} typeOptions={typeOptions} platformOptions={platformOptions} error={fieldErrorFor(errors, f)} />
          ))}
        </fieldset>
      ))}
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 py-3 admin:-mx-6 admin:px-6">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancelClick}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

/** D2's Edit button + the D3 sheet (Admin only — the button is absent for Reviewer). */
export function EditSellerButton({
  seller,
  typeOptions,
  platformOptions,
  ctx,
}: {
  seller: SellerEditDefaults;
  typeOptions: { value: string; label: string }[];
  platformOptions: { value: string; label: string }[];
  ctx: SellerCtx;
}) {
  const [open, setOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open ? (
        // While the discard confirm sits above, the outer sheet ignores close gestures (Esc,
        // dimmer, ×) so the form — and its values — survive underneath.
        <Sheet title={`Edit ${seller.name}`} onClose={() => { if (!discarding) setOpen(false); }}>
          <EditSellerForm
            seller={seller}
            typeOptions={typeOptions}
            platformOptions={platformOptions}
            ctx={ctx}
            onClose={() => setOpen(false)}
            onDiscardRequest={() => setDiscarding(true)}
          />
        </Sheet>
      ) : null}
      {open && discarding ? (
        <Sheet title="Discard your changes?" onClose={() => setDiscarding(false)}>
          <p className="font-sans text-base">Your edits will be lost.</p>
          <div className="flex flex-col gap-2 admin:flex-row">
            <button type="button" className="btn btn-primary" onClick={() => setDiscarding(false)}>
              Keep editing
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDiscarding(false);
                setOpen(false);
              }}
            >
              Discard changes
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

// ─── D4 — Classification ─────────────────────────────────────────────────────

/** The D4 form: two radio cards + the house line + the optional Why note. Exported for tests. */
export function ClassifyForm({ sellerName, isSmallFarm, isCandidate, ctx }: { sellerName: string; isSmallFarm: boolean; isCandidate: boolean; ctx: SellerCtx }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
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

  const card = (value: "true" | "false", title: string, words: string) => (
    <label className="block cursor-pointer rounded-control border border-line-strong bg-surface p-4 has-[:checked]:border-leaf has-[:checked]:bg-leaf-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-focus">
      <span className="flex items-start gap-3">
        <input type="radio" name="is_small_farm" value={value} defaultChecked={(value === "true") === isSmallFarm} className="mt-1 size-5 shrink-0 accent-leaf" />
        <span>
          <span className="block font-sans text-base font-semibold">{title}</span>
          <span className="mt-0.5 block font-sans text-[15px] text-ink-soft">{words}</span>
        </span>
      </span>
    </label>
  );

  return (
    <form ref={formRef} method="post" action="/admin/sellers/actions" onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="action" value="classify" />
      <HiddenCtx ctx={ctx} />
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-control border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{error}</span>
          </p>
        </div>
      ) : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-sans text-base font-semibold">Is {sellerName} a small farm, or a larger operation?</legend>
        {card("true", "Small farm", "Shows the Small farm badge on their page and listings, and includes them in the Small farms filter.")}
        {card("false", "Not a small farm", "No badge is shown. They're listed like any other seller.")}
      </fieldset>
      <p className="font-sans text-[15px] text-ink-soft">This is a judgment call — there&apos;s no size test. When in doubt, leave the badge off.</p>
      <p>
        <label htmlFor="classify-note" className="mb-1 block font-sans text-sm font-semibold">
          Why <span className="font-normal text-muted">(optional — kept with the internal notes)</span>
        </label>
        <textarea id="classify-note" name="note" rows={3} maxLength={2000} autoComplete="off" className="field min-h-target w-full" />
      </p>
      {isCandidate ? <p className="font-sans text-[15px] text-ink-soft">Saving the classification lists {sellerName} publicly — their details are finished.</p> : null}
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 py-3 admin:-mx-6 admin:px-6">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save classification"}
        </button>
      </div>
    </form>
  );
}

/** D2's Change button + the D4 sheet (Admin only — the button is absent for Reviewer). */
export function ClassifyButton({ sellerName, isSmallFarm, isCandidate, ctx }: { sellerName: string; isSmallFarm: boolean; isCandidate: boolean; ctx: SellerCtx }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Change
      </button>
      {open ? (
        <Sheet title={`Classify ${sellerName}`} onClose={() => setOpen(false)}>
          <ClassifyForm sellerName={sellerName} isSmallFarm={isSmallFarm} isCandidate={isCandidate} ctx={ctx} />
        </Sheet>
      ) : null}
    </>
  );
}

// ─── D5 — Note composer ──────────────────────────────────────────────────────

/** The composer: one textarea behind the Add note button (never an open box). Exported for tests. */
export function NoteComposerForm({ ctx }: { ctx: SellerCtx }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
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
    // The composer keeps the text — the uncontrolled textarea is never cleared.
    setError(r.errors.find((x) => x.field === "form" || x.field === "body")?.message ?? "That didn't go through.");
    setBusy(false);
  }

  return (
    <form ref={formRef} method="post" action="/admin/sellers/actions" onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="action" value="add_note" />
      <HiddenCtx ctx={ctx} />
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-control border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{error}</span>
          </p>
        </div>
      ) : null}
      <p>
        <label htmlFor="note-body" className="mb-1 block font-sans text-sm font-semibold">
          Note
        </label>
        <textarea id="note-body" name="body" rows={5} maxLength={2000} autoComplete="off" aria-invalid={error ? true : undefined} className="field min-h-[88px] w-full" />
      </p>
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 py-3 admin:-mx-6 admin:px-6">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add note"}
        </button>
      </div>
    </form>
  );
}

/** D5's Add note button + composer sheet (both roles). */
export function AddNoteButton({ ctx }: { ctx: SellerCtx }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Add note
      </button>
      {open ? (
        <Sheet title="Add a note" onClose={() => setOpen(false)}>
          <NoteComposerForm ctx={ctx} />
        </Sheet>
      ) : null}
    </>
  );
}

// ─── Danger zone ─────────────────────────────────────────────────────────────

function DangerButton({ label, title, consequence, verb, action, ctx }: { label: string; title: string; consequence: string; verb: string; action: string; ctx: SellerCtx }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </button>
      <form ref={formRef} method="post" action="/admin/sellers/actions" className="hidden" aria-hidden="true" tabIndex={-1}>
        <input type="hidden" name="action" value={action} />
        <HiddenCtx ctx={ctx} />
      </form>
      {open ? (
        <ConfirmDialog
          title={title}
          consequence={consequence}
          verb={verb}
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

function listingsClause(n: number): string {
  return n === 1 ? "Their page and 1 listing will come off the public site." : n === 0 ? "Their page will come off the public site." : `Their page and ${n} listings will come off the public site.`;
}

/** The §10.1 consequence lines (exported for tests — the dialog renders them verbatim). */
export function deactivateConsequence(listingCount: number): string {
  return `${listingsClause(listingCount)} Reactivating brings them back.`;
}

export function removeConsequence(listingCount: number): string {
  return `${listingsClause(listingCount)} This can be undone by Hue from the record, not from this screen.`;
}

/** Deactivate (Admin only): the reversible hide, behind its §10.1 confirm. */
export function DeactivateButton({ sellerName, listingCount, ctx }: { sellerName: string; listingCount: number; ctx: SellerCtx }) {
  return <DangerButton label="Deactivate seller" title={`Deactivate ${sellerName}?`} consequence={deactivateConsequence(listingCount)} verb="Deactivate seller" action="deactivate" ctx={ctx} />;
}

/** Remove (Admin only): the harder action, behind its §10.1 confirm. */
export function RemoveButton({ sellerName, listingCount, ctx }: { sellerName: string; listingCount: number; ctx: SellerCtx }) {
  return <DangerButton label="Remove seller" title={`Remove ${sellerName}?`} consequence={removeConsequence(listingCount)} verb="Remove seller" action="remove" ctx={ctx} />;
}
