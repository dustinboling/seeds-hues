"use client";

/**
 * A native POST form whose submit button takes a busy label while the submission is in
 * flight (spec §7A "Sending…" states). Progressive enhancement: without JS it is an
 * ordinary form. No effects, no refs — the busy flag is set in the submit handler only.
 */
import { useState, type ReactNode } from "react";

export function BusyForm({ action, submitLabel, busyLabel, children }: { action: string; submitLabel: string; busyLabel: string; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <form method="post" action={action} onSubmit={() => setBusy(true)}>
      <fieldset disabled={busy} className="flex flex-col gap-3">
        {children}
        <div>
          <button type="submit" className="btn btn-primary">
            {busy ? busyLabel : submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
