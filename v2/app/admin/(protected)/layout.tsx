/**
 * The guarded admin tree (Slice 0): every page here calls requireAdmin() first (no valid
 * admin session → /admin/sign-in; visitor role → the wrong-role landing). The whole tree
 * is non-indexed. The legacy /admin/waitlist lives outside this group, untouched.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminProtectedLayout({ children }: { children: ReactNode }) {
  return children;
}
