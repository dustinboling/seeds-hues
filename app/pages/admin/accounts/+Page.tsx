import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import "../../../src/forms.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { AccountsView, type AccountDetailData, type AccountRow } from "../../../src/components/admin/AccountsView";
import { getAdmin } from "../../../src/components/admin/api";
import type { Data } from "./+data";

export default function Page() {
  const { viewer, selected } = useData<Data>();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AccountDetailData | null>(null);
  const [sellerOptions, setSellerOptions] = useState<{ slug: string; name: string; location: string | null }[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);

  useEffect(() => {
    if (!viewer || viewer.role !== "admin") return;
    let live = true;
    const params = new URLSearchParams(window.location.search);
    void getAdmin<{ totalWaiting: number }>("/api/internal/admin/home").then((r) => {
      if (live && r.ok) setReviewTotal(r.data.totalWaiting);
    });
    void getAdmin<{ rows: AccountRow[]; total: number }>(`/api/internal/admin/accounts?${params.toString()}`).then((r) => {
      if (live && r.ok) {
        setRows(r.data.rows);
        setTotal(r.data.total);
      }
    });
    void getAdmin<{ slug: string; name: string; location: string | null }[]>("/api/internal/admin/seller-options").then((r) => {
      if (live && r.ok) setSellerOptions(r.data);
    });
    const id = params.get("account") ?? "";
    if (/^\d+$/.test(id)) {
      void getAdmin<AccountDetailData>(`/api/internal/admin/accounts/${id}`).then((r) => {
        if (live && r.ok) setDetail(r.data);
      });
    }
    return () => {
      live = false;
    };
  }, [viewer]);

  if (!viewer) {
    return (
      <div className="admin-root admin-narrow">
        <div className="card admin-flow-card">
          <h1 className="admin-title">Accounts</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin%2Faccounts">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="accounts" reviewTotal={reviewTotal}>
      <AccountsView
        rows={rows}
        total={total}
        selected={selected}
        detail={detail}
        role={viewer.role}
        selfId={viewer.id}
        sellerOptions={sellerOptions}
        onDone={(r) => {
          window.location.href = r.redirect;
        }}
      />
    </AdminShell>
  );
}
