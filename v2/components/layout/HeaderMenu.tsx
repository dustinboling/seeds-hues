"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/**
 * Header hamburger: a disclosure nav (not a modal). The button toggles the panel; Escape closes it
 * and returns focus to the button; a pointerdown outside closes it; a route change closes it.
 * Opening moves focus to the first link; Tab/Shift+Tab move through and out naturally (no trap).
 */
export function HeaderMenu() {
  const pathname = usePathname() ?? "/";
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
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative flex-none">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="header-menu-panel"
        data-testid="header-menu-button"
        onClick={() => setOpen((o) => !o)}
        className="tap inline-flex items-center justify-center rounded-full text-ink transition-colors duration-150 ease-out hover:bg-leaf-50 hover:text-leaf"
      >
        <MenuIcon />
      </button>
      <div
        id="header-menu-panel"
        data-testid="header-menu"
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-line bg-paper py-2 shadow-lg"
      >
        <nav aria-label="Menu">
          <ul>
            {ITEMS.map((item, i) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex min-h-[44px] items-center px-4 font-sans no-underline hover:bg-leaf-50 ${current ? "font-semibold text-leaf" : "text-ink"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
