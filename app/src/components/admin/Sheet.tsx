import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * The admin sheet (no-open-forms rule): creation/editing lives behind a
 * button opening this pop-up. Ported from v2's Sheet — Esc + dimmer
 * close, focus moved inside, labelled by the title.
 */
export function Sheet({ title, onClose, initialFocusRef, children }: { title: string; onClose: () => void; initialFocusRef?: RefObject<HTMLButtonElement | null>; children?: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const target = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>("button, input, select, textarea");
    target?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, initialFocusRef]);

  return (
    <div className="admin-sheet-dimmer" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="admin-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-sheet-head">
          <h2 className="admin-sheet-title">{title}</h2>
          <button type="button" className="admin-sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="admin-sheet-body">{children}</div>
      </div>
    </div>
  );
}
