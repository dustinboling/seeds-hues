import { useData } from "vike-react/useData";
import "../../../src/variety.css";
import { CropView } from "../../../src/components/crop/CropView";
import type { Data } from "./+data";

export default function Page() {
  const { hub } = useData<Data>();
  return <CropView resolved={{ kind: "ok", data: hub }} />;
}
