/**
 * Zero-seller copy — the ONE home of every user-visible "no seller lists
 * this" string. Ported from v2/lib/zero-seller.ts.
 *
 * The canonical form is the answer sentence: "No seller found selling {name}
 * yet." Every surface below derives from this module.
 */

/** The canonical zero-seller sentence (the answer sentence). */
export function zeroSellerSentence(name: string): string {
  return `No seller found selling ${name} yet.`;
}

/** Card short form of the canonical sentence (the VarietyCard availability line). */
export const ZERO_SELLER_SHORT = "No sellers yet";

/**
 * Meta-title parenthetical form of the canonical sentence: the "(…)" in
 * "… Seeds — Where to Buy (…)" titles, title-cased to match its siblings.
 */
export const ZERO_SELLER_TITLE = "No Seller Found Yet";

/**
 * Seller-surface form: a different fact (a seller with no listings, not a
 * variety with no sellers). Kept verbatim here so the whole family lives in
 * one place.
 */
export const SELLER_NO_LISTINGS = "No listings for this seller yet.";
