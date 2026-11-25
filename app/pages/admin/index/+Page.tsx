import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { HubView, type HubQueueCard, type HubSnapshotCard } from "../../../src/components/admin/HubView";
import { getAdmin } from "../../../src/components/admin/api";
import type { Data } from "./+data";

interface HomeData {
  cards: HubQueueCard[];
  totalWaiting: number;
  decisions: { text: string; at: string }[];
  wanted: { slug: string; name: string; waiters: number }[];
  snapshot: { cards: HubSnapshotCard[] };
}

const EMPTY: HomeData = { cards: [], totalWaiting: 0, decisions: [], wanted: [], snapshot: { cards: [] } };

export default function Page() {
  const { viewer } = useData<Data>();
  const [home, setHome] = useState<HomeData>(EMPTY);
  useEffect(() => {
    let live = true;
    void getAdmin<HomeData>("/api/internal/admin/home").then((r) => {
      if (live && r.ok) setHome(r.data);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!viewer) {
    return (
      <div className="admin-root admin-narrow">
        <div className="card admin-flow-card">
          <h1 className="admin-title">Admin home</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="home" reviewTotal={home.totalWaiting}>
      <HubView viewer={{ name: viewer.name, role: viewer.role }} cards={home.cards} totalWaiting={home.totalWaiting} decisions={home.decisions} wanted={home.wanted} snapshot={home.snapshot} />
    </AdminShell>
  );
}
