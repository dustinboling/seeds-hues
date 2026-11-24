import { FONT_STACKS } from "../../src/design-system/fonts";
import { sysSlots, sysValue } from "../../src/design-system/tokens";
import { APP_SHORT_NAME, SITE_NAME } from "../../src/site";

/**
 * Slice-1 proof route: renders the shell with the directory's name and no
 * marketing copy, plus two data-driven proofs (token swatches, font stacks)
 * for the gate's rendered-diff check. Never deployed in this slice.
 */
export default function Page() {
  return (
    <>
      <h1>{APP_SHORT_NAME}</h1>
      <p className="proof-domain">{SITE_NAME}</p>

      <section aria-labelledby="proof-tokens">
        <h2 id="proof-tokens">Color tokens</h2>
        <ul className="proof-swatches">
          {sysSlots().map((slot) => {
            const value = sysValue(slot);
            return (
              <li key={slot} className="proof-swatch">
                <span
                  className="proof-chip"
                  style={{ backgroundColor: value }}
                  aria-hidden="true"
                />
                <span className="proof-token-name">{slot}</span>{" "}
                <code className="proof-token-value">{value}</code>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="proof-fonts">
        <h2 id="proof-fonts">Font stacks</h2>
        <p className="font-proof-display" style={{ fontFamily: FONT_STACKS.display }}>
          Display — Fraunces
        </p>
        <p className="font-proof-serif" style={{ fontFamily: FONT_STACKS.serif }}>
          Prose — Newsreader
        </p>
        <p className="font-proof-sans" style={{ fontFamily: FONT_STACKS.sans }}>
          Interface — Source Sans 3
        </p>
      </section>
    </>
  );
}
