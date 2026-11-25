import { useData } from "vike-react/useData";
import "../../src/forms.css";
import { FarmPage } from "../../src/components/farm/FarmPage";
import type { Data } from "./+data";

export default function Page() {
  const { siteKey, states, defaults, outcome } = useData<Data>();
  return <FarmPage siteKey={siteKey} states={states} defaults={defaults} outcome={outcome} />;
}
