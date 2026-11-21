import { roleLabel } from "@/lib/admin-auth";

/** Role word as a chip — text, never color alone (spec §5 rule 5). */
export function RoleChip({ role }: { role: string }) {
  const admin = role === "admin";
  return <span className={admin ? "chip bg-leaf-50 font-semibold text-leaf" : "chip"}>{roleLabel(role)}</span>;
}
