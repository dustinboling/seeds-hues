import { roleLabel } from "@/lib/admin-auth";

/** Role word as an inert tag — text, never color alone (spec §5 rule 5). */
export function RoleChip({ role }: { role: string }) {
  const admin = role === "admin";
  return <span className={admin ? "chip-tag bg-leaf-50 font-semibold text-leaf" : "chip-tag"}>{roleLabel(role)}</span>;
}
