import { useData } from "vike-react/useData";
import "../../../src/variety.css";
import { ShopView } from "../../../src/components/seller/ShopView";
import type { Data } from "./+data";

export default function Page() {
  const { shop } = useData<Data>();
  return <ShopView resolved={shop} />;
}
