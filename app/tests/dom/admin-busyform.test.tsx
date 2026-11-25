// @vitest-environment jsdom
/**
 * Slice 7 BusyForm standard: EVERY admin form types real values, submits,
 * and the test asserts the payload the action endpoint receives contains
 * those values intact — a submit must never drop its own field values.
 * Rejections render the plain-language error with the typed values
 * preserved. The busy submit never disables its own fields (the founding
 * defect's mechanism is absent by construction).
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCodeForm, AdminEmailForm } from "../../src/components/admin/SignIn";
import { DecideForm, DuplicateDecideForm, ReasonDecideForm } from "../../src/components/admin/DecideForms";
import { ClassifyForm, NoteComposer, SellerEditForm } from "../../src/components/admin/SellerForms";
import { AliasAddForm, VarietyRemoveForm } from "../../src/components/admin/VarietyForms";
import { RetireForm } from "../../src/components/admin/ListingForms";
import { FarmOwnerForm, RoleForm } from "../../src/components/admin/AccountForms";

interface MockRoute {
  status: number;
  json: unknown;
}

function mockFetch(routes: Record<string, MockRoute>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fn = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const body = init?.body ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url: String(url), method: init?.method ?? "GET", body });
    const route = routes[String(url).split("?")[0]!] ?? { status: 404, json: { ok: false, message: "no mock" } };
    return { ok: route.status >= 200 && route.status < 300, status: route.status, json: async () => route.json };
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const field = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  expect(el, `field #${id}`).not.toBeNull();
  return el!;
};

const submitForm = (id: string): void => {
  fireEvent.submit(field(id).closest("form")!);
};

describe("AdminEmailForm payload-intact", () => {
  it("submits the typed email + return path intact", async () => {
    const { calls } = mockFetch({ "/admin/sign-in/request": { status: 200, json: { ok: true, redirect: "/admin/sign-in/code?email=ruth%40example.com" } } });
    const onSent = vi.fn();
    render(<AdminEmailForm next="/admin/review" onSent={onSent} />);
    fireEvent.change(field("admin-email"), { target: { value: "ruth@example.com" } });
    submitForm("admin-email");
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: "/admin/sign-in/request", body: { email: "ruth@example.com", next: "/admin/review" } });
    expect(onSent).toHaveBeenCalledWith("ruth@example.com");
  });

  it("a rejection keeps the typed email and shows the message", async () => {
    mockFetch({ "/admin/sign-in/request": { status: 400, json: { ok: false, message: "Enter your email address." } } });
    render(<AdminEmailForm next="/admin" onSent={() => {}} />);
    fireEvent.change(field("admin-email"), { target: { value: "ruth@example.com" } });
    submitForm("admin-email");
    await screen.findByText("Enter your email address.");
    expect((field("admin-email") as HTMLInputElement).value).toBe("ruth@example.com");
  });
});

describe("AdminCodeForm payload-intact", () => {
  it("submits email + code + return path intact", async () => {
    const { calls } = mockFetch({ "/admin/sign-in/verify": { status: 200, json: { ok: true, redirect: "/admin" } } });
    const onVerified = vi.fn();
    render(<AdminCodeForm email="ruth@example.com" next="/admin/review" ttlMinutes={10} onVerified={onVerified} />);
    fireEvent.change(field("admin-code"), { target: { value: "222222" } });
    submitForm("admin-code");
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: "/admin/sign-in/verify", body: { email: "ruth@example.com", code: "222222", next: "/admin/review" } });
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("states the real code TTL from props (never a hardcoded figure)", () => {
    render(<AdminCodeForm email="ruth@example.com" next="/admin" ttlMinutes={10} onVerified={() => {}} />);
    expect(screen.getByText(/It works for 10 minutes\./)).not.toBeNull();
  });
});

describe("DecideForm payload-intact (publish)", () => {
  it("publishes with the full hidden context intact", async () => {
    const { calls } = mockFetch({ "/admin/review/decide": { status: 200, json: { ok: true, redirect: "/admin/review?queue=listings" } } });
    const onDone = vi.fn();
    render(<DecideForm action="publish_listing" kind="review" id={101} ctx={{ queue: "listings", show: "25", created_at: "2026-11-20T09:00:00.000Z", variety_name: "Lonely Bloom" }} submitLabel="Publish listing" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "publish_listing", kind: "review", id: 101, queue: "listings", show: "25", created_at: "2026-11-20T09:00:00.000Z", variety_name: "Lonely Bloom" });
    expect(onDone).toHaveBeenCalledWith({ redirect: "/admin/review?queue=listings" });
  });
});

describe("ReasonDecideForm payload-intact (dismiss with reason)", () => {
  it("sends reason_select + reason_note verbatim (the server composes)", async () => {
    const { calls } = mockFetch({ "/admin/review/decide": { status: 200, json: { ok: true, redirect: "/admin/review?queue=reports" } } });
    render(<ReasonDecideForm action="dismiss_report" kind="review" id={104} ctx={{ queue: "reports" }} reasons={["Wrong variety", "Not seed"]} buttonLabel="Dismiss" sheetTitle="Dismiss this report" submitLabel="Dismiss" />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Not seed" } });
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "The listing is live." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[1]!);
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "dismiss_report", kind: "review", id: 104, queue: "reports", reason_select: "Not seed", reason_note: "The listing is live." });
  });

  it("a rejection preserves the typed reason fields", async () => {
    mockFetch({ "/admin/review/decide": { status: 422, json: { ok: false, message: "That didn't go through. Nothing was changed — try again." } } });
    render(<ReasonDecideForm action="dismiss_report" kind="review" id={104} ctx={{ queue: "reports" }} reasons={["Wrong variety", "Not seed"]} buttonLabel="Dismiss" sheetTitle="Dismiss this report" submitLabel="Dismiss" />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Not seed" } });
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "The listing is live." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[1]!);
    await screen.findByText("That didn't go through. Nothing was changed — try again.");
    expect((screen.getByLabelText("Reason (optional)") as HTMLSelectElement).value).toBe("Not seed");
    expect((screen.getByLabelText("Note (optional)") as HTMLInputElement).value).toBe("The listing is live.");
  });
});

describe("DuplicateDecideForm payload-intact (both outcomes)", () => {
  const ctx = { queue: "duplicates", show: "25", created_at: "2026-11-22T11:00:00.000Z", held_name: "King's Ransom Select", candidate_name: "King's Ransom" };

  it("mark-duplicate confirms with the duplicate action + context intact", async () => {
    const { calls } = mockFetch({ "/admin/review/decide": { status: 200, json: { ok: true, redirect: "/admin/review?queue=duplicates" } } });
    render(<DuplicateDecideForm id={103} held="King's Ransom Select" existing="King's Ransom" ctx={ctx} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "It's a duplicate" }));
    expect(screen.getByText(/will be kept as another name for/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm: mark as duplicate" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "mark_duplicate", kind: "review", id: 103, ...ctx });
  });

  it("not-a-duplicate confirms with the add-hold-variety action intact", async () => {
    const { calls } = mockFetch({ "/admin/review/decide": { status: 200, json: { ok: true, redirect: "/admin/review?queue=duplicates" } } });
    render(<DuplicateDecideForm id={103} held="King's Ransom Select" existing="King's Ransom" ctx={ctx} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Not a duplicate" }));
    expect(screen.getByText(/will be added as its own variety/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm: add the variety" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "add_hold_variety", kind: "review", id: 103, ...ctx });
  });
});

describe("NoteComposer payload-intact", () => {
  it("sends seller + body verbatim", async () => {
    const { calls } = mockFetch({ "/admin/sellers/actions": { status: 200, json: { ok: true, redirect: "/admin/sellers?seller=geoseed#notes" } } });
    const onDone = vi.fn();
    render(<NoteComposer seller="geoseed" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.change(field("note-body"), { target: { value: "Called Tuesday — confirm  before  March." } });
    submitForm("note-body");
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "add_note", seller: "geoseed", body: "Called Tuesday — confirm  before  March." });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a rejection preserves the typed note", async () => {
    mockFetch({ "/admin/sellers/actions": { status: 422, json: { ok: false, message: "Write the note before adding it." } } });
    render(<NoteComposer seller="geoseed" onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.change(field("note-body"), { target: { value: "Called Tuesday." } });
    submitForm("note-body");
    await screen.findByText("Write the note before adding it.");
    expect((field("note-body") as HTMLTextAreaElement).value).toBe("Called Tuesday.");
  });

  it("the busy submit never disables its own fields", async () => {
    const { fn } = mockFetch({ "/admin/sellers/actions": { status: 200, json: { ok: true, redirect: "/admin/sellers" } } });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => void (release = resolve));
    fn.mockImplementationOnce(async () => {
      await gate;
      return { ok: true, status: 200, json: async () => ({ ok: true, redirect: "/admin/sellers" }) };
    });
    render(<NoteComposer seller="geoseed" onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    const form = field("note-body").closest("form")!;
    fireEvent.change(field("note-body"), { target: { value: "Called Tuesday." } });
    fireEvent.submit(form);
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.textContent).toBe("Adding…");
    expect(submit.disabled).toBe(true);
    expect((field("note-body") as HTMLTextAreaElement).disabled).toBe(false);
    expect(form.querySelector("fieldset[disabled]")).toBeNull();
    const data = new FormData(form);
    expect(data.get("body")).toBe("Called Tuesday.");
    await act(async () => {
      release();
    });
    await act(async () => {});
  });
});

describe("SellerEditForm payload-intact", () => {
  const defaults = { seller: "geoseed", name: "GeoSeed", location: "Clinton, SC", region: "SC", shipsTo: "" };

  it("sends every typed field intact", async () => {
    const { calls } = mockFetch({ "/admin/sellers/actions": { status: 200, json: { ok: true, redirect: "/admin/sellers?seller=geoseed", changed: ["location"] } } });
    render(<SellerEditForm defaults={defaults} onDone={() => {}} />);
    fireEvent.change(field("seller-location"), { target: { value: "Greenwood, SC" } });
    submitForm("seller-location");
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({ action: "edit_save", seller: "geoseed", name: "GeoSeed", location: "Greenwood, SC", region: "SC" });
  });

  it("a rejection preserves every typed value", async () => {
    mockFetch({ "/admin/sellers/actions": { status: 422, json: { ok: false, message: "Some fields need attention before saving." } } });
    render(<SellerEditForm defaults={defaults} onDone={() => {}} />);
    fireEvent.change(field("seller-location"), { target: { value: "Greenwood, SC" } });
    submitForm("seller-location");
    await screen.findByText("Some fields need attention before saving.");
    expect((field("seller-location") as HTMLInputElement).value).toBe("Greenwood, SC");
    expect((field("seller-name") as HTMLInputElement).value).toBe("GeoSeed");
  });
});

describe("ClassifyForm payload-intact", () => {
  it("sends the chosen badge value intact", async () => {
    const { calls } = mockFetch({ "/admin/sellers/actions": { status: 200, json: { ok: true, redirect: "/admin/sellers?seller=geoseed" } } });
    render(<ClassifyForm seller="geoseed" sellerName="GeoSeed" isSmallFarm={false} isCandidate onDone={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /^Small farm/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save classification" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "classify", seller: "geoseed", is_small_farm: true });
  });
});

describe("RetireForm payload-intact", () => {
  it("sends listing + reason + note intact", async () => {
    const { calls } = mockFetch({ "/admin/listings/actions": { status: 200, json: { ok: true, redirect: "/admin/listings?listing=501" } } });
    render(<RetireForm listing={501} varietyName="King's Ransom" onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Retire listing" }));
    fireEvent.change(field("retire-reason"), { target: { value: "Dead link" } });
    fireEvent.change(field("retire-note"), { target: { value: "Gone since spring." } });
    submitForm("retire-reason");
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "retire", listing: 501, reason: "Dead link", note: "Gone since spring." });
  });

  it("a rejection preserves reason + note", async () => {
    mockFetch({ "/admin/listings/actions": { status: 422, json: { ok: false, message: "Choose a reason." } } });
    render(<RetireForm listing={501} varietyName="King's Ransom" onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Retire listing" }));
    fireEvent.change(field("retire-reason"), { target: { value: "Dead link" } });
    fireEvent.change(field("retire-note"), { target: { value: "Gone since spring." } });
    submitForm("retire-reason");
    await screen.findByText("Choose a reason.");
    expect((field("retire-reason") as HTMLSelectElement).value).toBe("Dead link");
    expect((field("retire-note") as HTMLInputElement).value).toBe("Gone since spring.");
  });
});

describe("AliasAddForm payload-intact", () => {
  it("sends variety + name intact", async () => {
    const { calls } = mockFetch({ "/admin/varieties/actions": { status: 200, json: { ok: true, redirect: "/admin/varieties?variety=cosmos-lonely-bloom" } } });
    render(<AliasAddForm variety="cosmos-lonely-bloom" onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add another name" }));
    fireEvent.change(field("alias-name"), { target: { value: "Lonely Bloom Select" } });
    submitForm("alias-name");
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "alias_add", variety: "cosmos-lonely-bloom", name: "Lonely Bloom Select" });
  });

  it("a rejection preserves the typed name", async () => {
    mockFetch({ "/admin/varieties/actions": { status: 422, json: { ok: false, message: "Enter another name." } } });
    render(<AliasAddForm variety="cosmos-lonely-bloom" onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add another name" }));
    fireEvent.change(field("alias-name"), { target: { value: "Lonely Bloom Select" } });
    submitForm("alias-name");
    await screen.findByText("Enter another name.");
    expect((field("alias-name") as HTMLInputElement).value).toBe("Lonely Bloom Select");
  });
});

describe("VarietyRemoveForm (confirm carries the consequence)", () => {
  it("the blocked state names the live-listing count and offers no submit", () => {
    render(<VarietyRemoveForm variety="sweet-pea-kings-ransom" varietyName="King's Ransom" liveListings={3} onDone={() => {}} />);
    expect(screen.getByText("This variety has 3 live listings. Retire them before removing the variety.")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("at zero listings the confirm posts the remove intact", async () => {
    const { calls } = mockFetch({ "/admin/varieties/actions": { status: 200, json: { ok: true, redirect: "/admin/varieties" } } });
    render(<VarietyRemoveForm variety="cosmos-lonely-bloom" varietyName="Lonely Bloom" liveListings={0} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove variety" }));
    expect(screen.getByText(/public page will come off the site/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm: remove the variety" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "variety_remove", variety: "cosmos-lonely-bloom" });
  });
});

describe("RoleForm + FarmOwnerForm payload-intact", () => {
  it("sends account + role intact", async () => {
    const { calls } = mockFetch({ "/admin/accounts/actions": { status: 200, json: { ok: true, redirect: "/admin/accounts?account=3" } } });
    render(<RoleForm account={3} accountName="Willa Gardener" current="visitor" self={false} onDone={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Reviewer/));
    fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "role_save", account: 3, role: "reviewer" });
  });

  it("self-view renders no submit (Act = absent) with the explanation", () => {
    render(<RoleForm account={1} accountName="Dustin" current="admin" self onDone={() => {}} />);
    expect(screen.getByText("You can't change your own role.")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Save role" })).toBeNull();
  });

  it("farm-owner grant sends account + seller intact", async () => {
    const { calls } = mockFetch({ "/admin/accounts/actions": { status: 200, json: { ok: true, redirect: "/admin/accounts?account=4" } } });
    render(<FarmOwnerForm account={4} accountName="Sam Seedbuyer" options={[{ slug: "geoseed", name: "GeoSeed", location: "Clinton, SC" }]} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "geoseed" } });
    fireEvent.click(screen.getByRole("button", { name: "Set as farm owner" }));
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ action: "farm_grant", account: 4, seller: "geoseed" });
  });
});
