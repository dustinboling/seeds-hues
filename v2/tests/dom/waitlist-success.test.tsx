// @vitest-environment jsdom
/**
 * Waitlist success moment after the 2026-11-21 Motif B retirement: the success state itself
 * stays with its wording exactly as it was; only the ornament is gone. Renders the block as
 * the zero-seller variety page composes it, with the visitor already on the list (state A:
 * verified, alerts on), and asserts the render carries no Motif B reference.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WaitlistBlock } from "@/components/variety/WaitlistBlock";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const STATUS = {
  signed_in: true,
  variety: { slug: "zinnia-sunset", name: "Sunset", listed: false },
  on_list: true,
  user: { name: "Test", email_verified: true, sms_opt_in: false, alert_phone_verified: false },
  channels: ["email"],
  turnstile_site_key: null,
};

describe("WaitlistBlock success moment (no Motif B)", () => {
  it("keeps its exact wording and renders no motif", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ data: STATUS }) }) as unknown as Response);
    const { container } = render(<WaitlistBlock varietySlug="zinnia-sunset" varietyName="Sunset" />);
    const heading = await screen.findByRole("heading", { name: "You’re on the waiting list for Sunset — glad to have you here." });
    expect(heading.id).toBe("waitlist-success-title");
    const html = container.innerHTML;
    expect(html).not.toContain("motif-divider-b");
    expect(html).not.toContain("motif-b");
    expect(html).not.toContain("ornaments/");
  });
});
