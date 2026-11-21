/**
 * The seller-description publication guard (audit 2026-11-21 C1 + C2): prices are
 * captured but NEVER shown, and working notes never publish as About copy.
 * descriptionViolations() is pure — these cases pin its classes without a database.
 */
import { describe, expect, it } from "vitest";
import { descriptionViolations } from "@/lib/services/admin";

describe("price: a currency amount in any form", () => {
  it.each([
    "Packets are $4.65 each.",
    "Packets are $ 4.65 each.",
    "Priced at USD 5 per packet.",
    "Each packet is 5 USD.",
    "Packets cost 4 dollars each.",
    "A packet is 4 dollar.",
    "Each one is 5 bucks.",
    "The price $4.65 covers shipping.",
    "Priced at $4.65.",
    "Price: 4.65 per packet.",
  ])("flags %s", (text) => {
    expect(descriptionViolations(text)).toContain("price");
  });

  it("the bare word dollar(s) with no amount is clean", () => {
    for (const text of [
      "We accept dollars at the farm stand.",
      "Every dollar stays on the farm.",
      "A packet costs a few dollars.",
      "Our prices are fair and stable.",
    ]) {
      expect(descriptionViolations(text), text).not.toContain("price");
    }
  });
});

describe("internal_marker: working-note scaffolding", () => {
  it.each([
    "Anchor: Basil 'Cinnamon' — working note",
    "badge: NO — leave OFF",
    "First line.\nFeed: none — products.json returned 404",
    "First line.\n  Note: check this",
    "Pending Hue review before publishing.",
    "HUE REVIEW needed.",
    "Coordinator to verify the address.",
    "COORDINATOR TO VERIFY",
    "Anchor text verified 2026-11-19",
    "Verified 2026-11-19 by the team.",
  ])("flags %s", (text) => {
    expect(descriptionViolations(text)).toContain("internal_marker");
  });

  it("mid-sentence lookalikes are clean", () => {
    for (const text of [
      "Please note our shipping schedule changes in winter.",
      "Take note: we ship on Mondays.",
      "The feed store next door sells our seed.",
      "We verified the address last week.",
      "Reviewed by Hue last spring.",
    ]) {
      expect(descriptionViolations(text), text).not.toContain("internal_marker");
    }
  });
});

describe("combined", () => {
  it("the audit's C1 shape flags both classes", () => {
    expect(descriptionViolations("Anchor: Basil 'Cinnamon' — $4.65 packet, verified 2026-11-19")).toEqual(["price", "internal_marker"]);
  });

  it("ordinary factual copy is clean", () => {
    expect(descriptionViolations("We grow heirloom zinnias on our family farm in Vermont.")).toEqual([]);
    expect(descriptionViolations("")).toEqual([]);
  });
});
