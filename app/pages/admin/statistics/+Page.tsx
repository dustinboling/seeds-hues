import { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import { AdminShell } from "../../../src/components/admin/AdminShell";
import { StatisticsView, type PopularityData } from "../../../src/components/admin/StatisticsView";
import type { HubSnapshotCard } from "../../../src/components/admin/HubView";
import { getAdmin } from "../../../src/components/admin/api";
import { NO_CLICKS_LINE, NO_VIEWS_LINE, type StatRange, type StatSignal } from "../../../src/lib/admin/statistics";
import type { Data } from "./+data";

function emptyPopularity(signal: StatSignal): PopularityData {
  if (signal === "waitlist") return { signal: "waitlist", rows: [], shown: 0, total: 0, caption: "The current waiting list — it doesn’t change with the date range.", error: false };
  if (signal === "searches") return { signal: "searches", top: [], topShown: 0, topTotal: 0, noResults: [], noResultsShown: 0, noResultsTotal: 0, caption: "", error: false };
  return {
    signal,
    title: signal === "clicks" ? "Most clicked varieties" : "Most viewed varieties",
    valueLabel: signal === "clicks" ? "Clicks" : "Views",
    rows: [],
    shown: 0,
    total: 0,
    thin: false,
    thinLine: null,
    emptyLine: signal === "clicks" ? NO_CLICKS_LINE : NO_VIEWS_LINE,
    soldOutLine: null,
    caption: "",
    error: false,
  };
}

export default function Page() {
  const { viewer, range, signal, show } = useData<Data>();
  const [cards, setCards] = useState<HubSnapshotCard[]>([]);
  const [period, setPeriod] = useState({ words: "", caption: "" });
  const [popularity, setPopularity] = useState<PopularityData>(() => emptyPopularity(signal));
  const [reviewTotal, setReviewTotal] = useState(0);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    const r = (params.get("range") ?? range) as StatRange;
    const s = (params.get("signal") ?? signal) as StatSignal;
    const sh = params.get("show") ?? String(show);
    void getAdmin<{ totalWaiting: number }>("/api/internal/admin/home").then((res) => {
      if (live && res.ok) setReviewTotal(res.data.totalWaiting);
    });
    void getAdmin<{ period: { words: string; caption: string }; cards: HubSnapshotCard[] }>(`/api/internal/admin/statistics/overview?range=${encodeURIComponent(r)}`).then((res) => {
      if (live && res.ok) {
        setPeriod(res.data.period);
        setCards(res.data.cards);
      }
    });
    void getAdmin<PopularityData>(`/api/internal/admin/statistics/popularity?range=${encodeURIComponent(r)}&signal=${encodeURIComponent(s)}&show=${encodeURIComponent(sh)}`).then((res) => {
      if (live && res.ok) setPopularity(res.data);
    });
    return () => {
      live = false;
    };
  }, [range, signal, show]);

  if (!viewer) {
    return (
      <div className="admin-root admin-narrow">
        <div className="card admin-flow-card">
          <h1 className="admin-title">Statistics</h1>
          <p className="admin-prose">
            <a href="/admin/sign-in?next=%2Fadmin%2Fstatistics">Sign in to admin</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <AdminShell viewer={viewer} section="statistics" reviewTotal={reviewTotal}>
      <StatisticsView range={range} signal={signal} show={show} period={period} cards={cards} popularity={popularity} />
    </AdminShell>
  );
}
