/**
 * Phone-only More destination (spec §6): Listings, Varieties, Accounts (admin only),
 * identity, and sign-out. On wider shells it renders the same list — one navigation
 * model, two shells, nothing reachable in one and hidden in the other.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { navFor } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { RoleChip } from "@/components/admin/RoleChip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "More" };

export default async function AdminMorePage() {
  const { viewer, totalWaiting } = await adminPageData("/admin/more");
  const links = navFor(viewer.role).filter((i) => i.key === "listings" || i.key === "varieties" || i.key === "accounts");
  return (
    <AdminShell viewer={viewer} section="more" reviewTotal={totalWaiting}>
      <h1 className="text-[28px] font-semibold leading-[1.15]">More</h1>
      <ul className="card mt-3 flex flex-col p-2">
        {links.map((item) => (
          <li key={item.key}>
            <a href={item.href} className="flex min-h-target items-center rounded-control px-3 py-2 font-sans hover:bg-paper-deep">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <section aria-label="Signed in" className="card mt-4 flex flex-col gap-2 p-4">
        <p className="font-sans font-semibold">{viewer.name}</p>
        <p className="break-words font-sans text-sm text-muted">{viewer.email}</p>
        <p>
          <RoleChip role={viewer.role} />
        </p>
        <form method="post" action="/admin/sign-in/sign-out">
          <button type="submit" className="btn btn-secondary">
            Sign out of admin
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
