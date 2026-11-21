/** Sellers section (Slice 0 frame — seller management lands in Slice B). */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { SectionFrame } from "@/components/admin/SectionFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sellers" };

export default async function AdminSellersPage() {
  const { viewer, totalWaiting } = await adminPageData("/admin/sellers");
  return <SectionFrame viewer={viewer} section="sellers" reviewTotal={totalWaiting} title="Sellers" line="Seller management arrives in a later build slice." />;
}
