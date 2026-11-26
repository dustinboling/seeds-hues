import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import "../../../src/forms.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { CropsView, VarietiesView, type VarietyDetailData, type VarietyRow } from "../../../src/components/admin/VarietiesView";
import { getAdmin } from "../../../src/components/admin/api";
import type { Data } from "./+data";

export default function Page() {
  const { viewer, selected, tab } = useData<Data>();
  const [rows, setRows] = useState<VarietyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<VarietyDetailData | null>(null);
  const [crops, setCrops] = useState<{ slug: string; commonName: string; varietyCount: number }[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const showCrops = tab === "crops";

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    void getAdmin<{ totalWaiting: number }>("/api/internal/admin/home").then((r) => {
      if (live && r.ok) setReviewTotal(r.data.totalWaiting);
    });
    if (params.get("tab") === "crops") {
      void getAdmin<{ slug: string; commonName: string; varietyCount: number }[]>("/api/internal/admin/crops").then((r) => {
        if (live && r.ok) setCrops(r.data);
      });
      return () => {
        live = false;
      };
    }
    void getAdmin<{ rows: VarietyRow[]; total: number }>(`/api/internal/admin/varieties?${params.toString()}`).then((r) => {
      if (live && r.ok) {
        setRows(r.data.rows);
        setTotal(r.data.total);
      }
    });
    const slug = params.get("variety");
    if (slug) {
      void getAdmin<VarietyDetailData>(`/api/internal/admin/varieties/${encodeURIComponent(slug)}`).then((r) => {
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
          <h1 className="admin-title">Varieties</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin%2Fvarieties">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="varieties" reviewTotal={reviewTotal}>
      {showCrops ? (
        <CropsView rows={crops} />
      ) : (
        <VarietiesView
          rows={rows}
          total={total}
          selected={selected}
          detail={detail}
          role={viewer.role}
          onDone={(r) => {
            window.location.href = r.redirect;
          }}
        />
      )}
    </AdminShell>
  );
}
