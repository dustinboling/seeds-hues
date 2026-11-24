/**
 * NAMED PLACEHOLDER — structure + slots only.
 *
 * The gated D1 tab-bar design builds post-cutover (BUILD-SEQUENCE.md "After
 * cutover" item 4); nothing here designs it. This component reserves the bar's
 * place in the shell: a labelled nav landmark with one slot per live tab (five,
 * mirroring v2's TabBar count as a structural fact), each slot empty and
 * presentational. No labels, no icons, no active state, no links.
 */
const SLOT_COUNT = 5;

export function TabBarPlaceholder() {
  return (
    <nav className="tabbar-placeholder" aria-label="Primary" data-placeholder="tab-bar-d1">
      <ul className="tabbar-slots">
        {Array.from({ length: SLOT_COUNT }, (_, index) => (
          <li key={index} className="tabbar-slot" aria-hidden="true" />
        ))}
      </ul>
    </nav>
  );
}
