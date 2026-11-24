import { useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { isCurrentSection } from "./HeaderNav";
import { MenuIcon } from "./icons";

const ITEMS = [
  { href: "/crop", label: "Crops" },
  { href: "/variety", label: "Varieties" },
  { href: "/seller", label: "Sellers" },
  { href: "/search", label: "Search" },
  { href: "/add-your-farm", label: "Add Your Farm" },
  { href: "/about", label: "About" },
  { href: "/account", label: "My Account" },
];

/**
 * Header hamburger: a disclosure nav (not a modal). The button toggles the
 * panel; Escape closes it and returns focus to the button; a pointerdown
 * outside closes it; a route change closes it. Opening moves focus to the
 * first link; Tab/Shift+Tab move through and out naturally (no trap).
 */
export function HeaderMenu() {
  const pathname = usePageContext().urlPathname ?? "/";
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close on route change (state adjusted during render rather than in an effect).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open ]);

  return (
    <div ref={wrapperRef} className="header-menu">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="header-menu-panel"
        data-testid="header-menu-button"
        onClick={() => setOpen((o) => !o)}
        className="header-icon-button"
      >
        <MenuIcon />
      </button>
      <div id="header-menu-panel" data-testid="header-menu" hidden={!open} className="header-menu-panel">
        <nav aria-label="Menu">
          <ul>
            {ITEMS.map((item, i) => {
              const current = isCurrentSection(pathname, item.href);
              return (
                <li key={item.href}>
                  <a
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`header-menu-link${current ? " header-menu-current" : ""}`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
