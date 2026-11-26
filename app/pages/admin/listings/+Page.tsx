import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import "../../../src/forms.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { ListingsView, type ListingDetailData, type ListingRow } from "../../../src/components/admin/ListingsView";
import { getAdmin } from "../../../src/components/admin/api";
import type { Data } from "./+data";

export default function Page() {
  const { viewer, selected } = useData<Data>();
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<ListingDetailData | null>(null);
  const [reviewTotal, setReviewTotal] = useState(0);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    void getAdmin<{ totalWaiting: number }>("/api/internal/admin/home").then((r) => {
      if (live && r.ok) setReviewTotal(r.data.totalWaiting);
    });
    void getAdmin<{ rows: ListingRow[]; total: number }>(`/api/internal/admin/listings?${params.toString()}`).then((r) => {
      if (live && r.ok) {
        setRows(r.data.rows);
        setTotal(r.data.total);
      }
    });
    const id = params.get("listing") ?? "";
    if (/^\d+$/.test(id)) {
      void getAdmin<ListingDetailData>(`/api/internal/admin/listings/${id}`).then((r) => {
        if (live && r.ok) setDetail(r.data);
      });
    }
    return () => {
      live = false;
    };
  }, []);

  if (!viewer) {
    return (
      <div className="admin-root admin-narrow">
        <div className="card admin-flow-card">
          <h1 className="admin-title">Listings</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin%2Flistings">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="listings" reviewTotal={reviewTotal}>
      <ListingsView
        rows={rows}
        total={total}
        selected={selected}
        detail={detail}
        role={viewer.role}
        onDone={(r) => {
          window.location.href = r.redirect;
        }}
      />
    </AdminShell>
  );
}
