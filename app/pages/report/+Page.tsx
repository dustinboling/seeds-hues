import { useData } from "vike-react/useData";
import "../../src/forms.css";
import { ReportForm } from "../../src/components/report/ReportForm";
import type { Data } from "./+data";

// The /report SSR form (Bea §5.2), ported from v2/app/report/page.tsx:
// the H1, the intro (removals within 48 hours, the /about/data link),
// and the real form in the first HTML.
export default function Page() {
  const { prefill, siteKey, outcome } = useData<Data>();
  return (
    <article className="form-page" aria-labelledby="report-title">
      <h1 id="report-title" className="page-title">
        Correct, claim or remove
      </h1>
      <p className="page-lede">
        One form for everything: tell us what is wrong, claim your seller page, or ask us to take it down. Every request
        goes to a person. A removal takes the seller’s page and all its listings down within 48 hours and stops our
        crawler from visiting the seller’s site. See <a href="/about/data">About the data</a>.
      </p>
      <ReportForm type={prefill.type} targetType={prefill.targetType} targetRef={prefill.targetRef} siteKey={siteKey} outcome={outcome} />
    </article>
  );
}
