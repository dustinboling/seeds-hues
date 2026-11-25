import { useData } from "vike-react/useData";
import "../../src/forms.css";
import { AccountPage } from "../../src/components/account/AccountPage";
import type { Data } from "./+data";

export default function Page() {
  const { siteKey, deleted } = useData<Data>();
  return <AccountPage siteKey={siteKey} deleted={deleted} />;
}
