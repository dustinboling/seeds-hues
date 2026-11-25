import { useData } from "vike-react/useData";
import "../../../src/variety.css";
import { VarietyView } from "../../../src/components/variety/VarietyView";
import type { Data } from "./+data";

export default function Page() {
  const { detail, siblings, smallFarmOnly, floor } = useData<Data>();
  return <VarietyView detail={detail} siblings={siblings} smallFarmOnly={smallFarmOnly} floor={floor} />;
}
