/**
 * Accounts section (Slice 0 frame — role management lands in Slice C). Admin only: a
 * reviewer lands on the wrong-role state for this section (spec §7 A4 pattern), never on
 * the data.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { NoAccess } from "@/components/admin/NoAccess";
import { SectionFrame } from "@/components/admin/SectionFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Accounts" };

export default async function AdminAccountsPage() {
  const { viewer, totalWaiting } = await adminPageData("/admin/accounts");
  if (viewer.role !== "admin") return <NoAccess variant="reviewer-accounts" />;
  return <SectionFrame viewer={viewer} section="accounts" reviewTotal={totalWaiting} title="Accounts" line="Account and role management arrives in a later build slice." />;
}
