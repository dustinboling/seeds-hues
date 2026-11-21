"use client";

/**
 * A native POST form whose submit button takes a busy label while the submission is in
 * flight (spec §7A "Sending…" states). Progressive enhancement: without JS it is an
 * ordinary form. No effects, no refs — the busy flag is set in the submit handler only.
 * Only the submit button ever disables: disabled controls are excluded from a native
 * submission's form data, so disabling the fields would submit the form empty.
 */
import { useState, type ReactNode } from "react";

export function BusyForm({ action, submitLabel, busyLabel, children }: { action: string; submitLabel: string; busyLabel: string; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <form method="post" action={action} onSubmit={() => setBusy(true)} aria-busy={busy || undefined}>
      <fieldset className="flex flex-col gap-3">
        {children}
        <div>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? busyLabel : submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
