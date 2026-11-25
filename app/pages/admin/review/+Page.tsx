import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { ReviewView, type DecidedRow, type ReviewDetail, type ReviewRow } from "../../../src/components/admin/ReviewView";
import { getAdmin } from "../../../src/components/admin/api";
import { parseItemRef } from "../../../src/lib/admin/review";
import type { Data } from "./+data";

export default function Page() {
  const { viewer, queue, item, decided } = useData<Data>();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reviewTotal, setReviewTotal] = useState(0);
  const [decidedRows, setDecidedRows] = useState<DecidedRow[]>([]);
  const [decidedTotal, setDecidedTotal] = useState(0);
  const selected = parseItemRef(item);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("queue") ?? queue;
    const show = params.get("show") ?? "25";
    void getAdmin<{ cards: { key: string; count: number }[]; totalWaiting: number }>("/api/internal/admin/home").then((r) => {
      if (live && r.ok) {
        setCounts(Object.fromEntries(r.data.cards.map((c) => [c.key, c.count])));
        setReviewTotal(r.data.totalWaiting);
      }
    });
    if (params.get("decided") === "1") {
      const page = params.get("page") ?? "1";
      void getAdmin<{ rows: DecidedRow[]; total: number }>(`/api/internal/admin/review/decided?queue=${encodeURIComponent(q)}&page=${encodeURIComponent(page)}`).then((r) => {
        if (live && r.ok) {
          setDecidedRows(r.data.rows);
          setDecidedTotal(r.data.total);
        }
      });
    } else {
      void getAdmin<{ rows: ReviewRow[]; total: number }>(`/api/internal/admin/review/queue?queue=${encodeURIComponent(q)}&show=${encodeURIComponent(show)}`).then((r) => {
        if (live && r.ok) {
          setRows(r.data.rows);
          setTotal(r.data.total);
        }
      });
    }
    const ref = parseItemRef(params.get("item"));
    if (ref && params.get("decided") !== "1") {
      void getAdmin<ReviewDetail>(`/api/internal/admin/review/detail?kind=${ref.kind}&id=${ref.id}`).then((r) => {
        if (live && r.ok) setDetail(r.data);
      });
    }
    return () => {
      live = false;
    };
  }, [queue]);

  if (!viewer) {
    return (
      <div className="admin-root admin-narrow">
        <div className="card admin-flow-card">
          <h1 className="admin-title">Review</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin%2Freview">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="review" reviewTotal={reviewTotal}>
      <ReviewView
        queue={queue}
        rows={rows}
        total={total}
        selected={selected}
        detail={detail}
        role={viewer.role}
        counts={counts}
        decided={decided}
        decidedRows={decidedRows}
        decidedTotal={decidedTotal}
        onDone={(r) => {
          window.location.href = r.redirect;
        }}
      />
    </AdminShell>
  );
}
