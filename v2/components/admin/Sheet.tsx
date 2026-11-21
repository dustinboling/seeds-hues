"use client";

/**
 * Shared sheet/pop-up pattern (spec §10): every create/edit in admin lives behind a button
 * that opens one of these — never an open form on a page. Bottom sheet on phones, centered
 * sheet on iPad/desktop. Focus is moved inside on open, trapped while open (Esc closes),
 * and returned to the opener on close; the opener is captured in the mount effect, never
 * during render. Later slices reuse this for edit sheets, the note composer, and declines.
 */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Sheet({
  title,
  onClose,
  initialFocusRef,
  describedById,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Element to focus on open (the safe action in destructive confirms); the panel otherwise. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  describedById?: string;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    (initialFocusRef?.current ?? panel)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.tabIndex >= 0);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose, initialFocusRef]);

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 min-[744px]:items-center min-[744px]:p-6" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        tabIndex={-1}
        className="mt-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[18px] bg-surface p-5 shadow-xl min-[744px]:m-auto min-[744px]:max-w-[560px] min-[744px]:rounded-[18px] min-[744px]:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="btn btn-secondary min-h-[44px] min-w-[44px] px-3">
            ×
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
