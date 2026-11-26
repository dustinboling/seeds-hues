import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import "../../../src/forms.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { MoreView } from "../../../src/components/admin/MoreView";
import { getAdmin } from "../../../src/components/admin/api";
import type { Data } from "./+data";

export default function Page() {
  const { viewer } = useData<Data>();
  const [reviewTotal, setReviewTotal] = useState(0);
  useEffect(() => {
    let live = true;
    void getAdmin<{ totalWaiting: number }>("/api/internal/admin/home").then((r) => {
      if (live && r.ok) setReviewTotal(r.data.totalWaiting);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!viewer) {
    return (
      <div className="admin-root admin-narrow">
        <div className="card admin-flow-card">
          <h1 className="admin-title">More</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin%2Fmore">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="more" reviewTotal={reviewTotal}>
      <MoreView viewer={viewer} />
    </AdminShell>
  );
}
