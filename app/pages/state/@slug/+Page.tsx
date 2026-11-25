import { useData } from "vike-react/useData";
import "../../../src/variety.css";
import { StateView } from "../../../src/components/state/StateView";
import type { Data } from "./+data";

export default function Page() {
  const { hub } = useData<Data>();
  return <StateView resolved={{ kind: "ok", data: hub }} />;
}
