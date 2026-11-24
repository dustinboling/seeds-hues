import { useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

/**
 * App-local equivalent of the @hues/ui route-transition mechanics (see SWAP.md):
 * on every client-side navigation, move focus to the main content and announce
 * the new page in a polite live region. The initial load is skipped — the
 * screen reader already reads the freshly loaded page.
 */
export function RouteAnnouncer() {
  const { urlOriginal } = usePageContext();
  const [message, setMessage] = useState("");
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById("main")?.focus();
    setMessage(document.title);
  }, [urlOriginal]);

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  );
}
