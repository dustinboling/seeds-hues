// @vitest-environment jsdom
/**
 * Slice 8 client error capture: window errors and unhandled rejections
 * reach the same-origin relay redacted (queries stripped, PII/prices out);
 * listeners detach on unmount.
 */
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorReporter } from "../../src/components/ErrorReporter";

describe("ErrorReporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function beaconBody(): Promise<string> {
    const calls = vi.mocked(navigator.sendBeacon).mock.calls;
    expect(calls).toHaveLength(1);
    const blob = calls[0]![1] as Blob;
    return blob.text();
  }

  it("reports window errors redacted, query stripped", async () => {
    const sendBeacon = vi.fn((_url: string, _body: Blob): boolean => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });
    render(<ErrorReporter />);
    await act(async () => {
      window.dispatchEvent(new ErrorEvent("error", { message: "boom for willa@example.com, $4.95" }));
    });
    const body = await beaconBody();
    expect(vi.mocked(sendBeacon).mock.calls[0]![0]).toBe("/api/client-errors");
    expect(body).not.toContain("willa@example.com");
    expect(body).not.toContain("$4.95");
    expect(body).toContain("ClientError");
  });

  it("reports unhandled rejections with the reason", async () => {
    const sendBeacon = vi.fn((_url: string, _body: Blob): boolean => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });
    render(<ErrorReporter />);
    // The constructor needs a promise; it is caught so the harness never sees a real rejection.
    const promise = Promise.reject(new TypeError("bad shape"));
    promise.catch(() => {});
    await act(async () => {
      window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { reason: new TypeError("bad shape"), promise }));
    });
    const body = await beaconBody();
    expect(body).toContain("UnhandledRejection");
    expect(body).toContain("bad shape");
  });

  it("detaches its listeners on unmount", async () => {
    const sendBeacon = vi.fn((_url: string, _body: Blob): boolean => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });
    const ui = render(<ErrorReporter />);
    ui.unmount();
    await act(async () => {
      window.dispatchEvent(new ErrorEvent("error", { message: "late" }));
    });
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
