import { useData } from "vike-react/useData";
import "../../../src/variety.css";
import { SeriesView } from "../../../src/components/series/SeriesView";
import type { Data } from "./+data";

export default function Page() {
  const { detail } = useData<Data>();
  return <SeriesView resolved={{ kind: "ok", detail }} />;
}
