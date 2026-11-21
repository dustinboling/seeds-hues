/**
 * Interim section frame (Slice 0): the shell plus a plain, honest line that the section
 * arrives in a later build slice. Later slices replace the line with the real section.
 */
import type { AdminSectionKey } from "@/lib/admin-auth";
import { AdminShell, type AdminShellViewer } from "./AdminShell";

export function SectionFrame({
  viewer,
  section,
  reviewTotal,
  title,
  line,
}: {
  viewer: AdminShellViewer;
  section: AdminSectionKey;
  reviewTotal: number;
  title: string;
  line: string;
}) {
  return (
    <AdminShell viewer={viewer} section={section} reviewTotal={reviewTotal}>
      <h1 className="text-[28px] font-semibold leading-[1.15]">{title}</h1>
      <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">{line}</p>
    </AdminShell>
  );
}
