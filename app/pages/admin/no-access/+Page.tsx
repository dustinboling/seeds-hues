import { useData } from "vike-react/useData";
import "../../../src/components/admin/admin.css";
import { NoAccess } from "../../../src/components/admin/NoAccess";
import type { Data } from "./+data";

export default function Page() {
  const { name, email } = useData<Data>();
  return <NoAccess variant="no-role" name={name} email={email} />;
}
