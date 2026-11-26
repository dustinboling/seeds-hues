/**
 * Pacing-contract tests for the catalog client (createCatalogApi).
 *
 * The Worker shares ONE catalog client per isolate across requests, and
 * under workerd's handle_cross_request_promise_resolution a promise created
 * by a request that has since ended can never settle. So the client's pace
 * state must never be a promise one request creates and another awaits:
 * each call reserves a plain-number slot and awaits only a sleep created
 * within its own call. These tests pin that contract with a fake fetch and
 * fake timers:
 *
 * (a) fetch starts from one client are spaced >= paceMs, sequential and
 *     concurrent;
 * (b) the 429 path still waits out Retry-After and retries (and maps
 *     errors like before);
 * (c) THE discriminating case: a call issued after an earlier call fully
 *     completed is not gated on any promise from the earlier call — the
 *     earlier call's trailing wait NEVER settling (workerd's dropped
 *     settlement) must not stop the later call.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, createCatalogApi } from "../../src/data/api";

type StubHeaders = { get: (name: string) => string | null };

type StubResponse = {
  status: number;
  ok: boolean;
  headers: StubHeaders;
  json: () => Promise<unknown>;
};

const headers = (retryAfter: string | null = null): StubHeaders => ({
  get: (name: string) => (name.toLowerCase() === "retry-after" ? retryAfter : null),
});

/** A minimal valid /coverage envelope (empty set — the shape is what matters). */
const coverageEnvelope = () => ({
  data: [],
  page: { next_cursor: null, has_more: false },
  meta: { nextCursor: null, count: 0, total: 0, generated_at: "2026-11-26T00:00:00Z" },
  error: null,
});

const ok = (): StubResponse => ({ status: 200, ok: true, headers: headers(), json: async () => coverageEnvelope() });

const rateLimited = (retryAfter: string | null): StubResponse => ({
  status: 429,
  ok: false,
  headers: headers(retryAfter),
  json: async () => ({}),
});

const asFetch = (impl: () => Promise<StubResponse>): typeof fetch =>
  impl as unknown as typeof fetch;

/** Let queued microtasks (promise continuations) run without firing any timer. */
async function flushMicrotasks(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("catalog client pacing contract", () => {
  it("(a) sequential fetch starts from one client are spaced >= paceMs", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      paceMs: 350,
      fetchImpl: asFetch(async () => {
        starts.push(Date.now());
        return ok();
      }),
    });

    await api.coverage();
    expect(starts).toHaveLength(1);

    const second = api.coverage();
    await flushMicrotasks();
    // The pace window has not elapsed: the second fetch must not have started.
    expect(starts).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    await second;
    expect(starts).toHaveLength(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(350);
  });

  it("(a) concurrent calls take successive slots: starts stay >= paceMs apart", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      paceMs: 350,
      fetchImpl: asFetch(async () => {
        starts.push(Date.now());
        return ok();
      }),
    });

    const calls = [api.coverage(), api.coverage(), api.coverage()];
    await flushMicrotasks();
    // Only the first slot's fetch may start before the window elapses.
    expect(starts).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all(calls);
    expect(starts).toHaveLength(3);
    const ordered = [...starts].sort((x, y) => x - y);
    expect(ordered[1]! - ordered[0]!).toBeGreaterThanOrEqual(350);
    expect(ordered[2]! - ordered[1]!).toBeGreaterThanOrEqual(350);
  });

  it("(a) paceMs 0 fetches immediately with no gating", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      paceMs: 0,
      fetchImpl: asFetch(async () => {
        calls++;
        return ok();
      }),
    });

    await api.coverage();
    const second = api.coverage();
    await flushMicrotasks();
    expect(calls).toBe(2);
    await second;
  });

  it("(b) a 429 waits out Retry-After, then retries the same read", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      paceMs: 350,
      fetchImpl: asFetch(async () => {
        calls++;
        return calls === 1 ? rateLimited("1") : ok();
      }),
    });

    const pending = api.coverage();
    await flushMicrotasks();
    expect(calls).toBe(1);

    // Retry-After 1s + 250ms skew: still waiting at +1s, retried by +2s.
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(calls).toBe(2);
  });

  it("(b) persistent 429s exhaust maxRetries, then throw the 429 as ApiRequestError", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      paceMs: 0,
      maxRetries: 2,
      fetchImpl: asFetch(async () => {
        calls++;
        return rateLimited("0");
      }),
    });

    const pending = expect(api.coverage()).rejects.toBeInstanceOf(ApiRequestError);
    await vi.runAllTimersAsync();
    await pending;
    // The first attempt plus maxRetries retries.
    expect(calls).toBe(3);
  });

  it("(b) non-429 errors still map to ApiRequestError with the status", async () => {
    vi.useFakeTimers();
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      fetchImpl: asFetch(async () => ({ status: 500, ok: false, headers: headers(), json: async () => ({}) })),
    });
    const error = await api.coverage().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(500);
  });

  it("(c) a later call is not gated on any promise from an earlier completed call", async () => {
    vi.useFakeTimers();
    // workerd drops the trailing sleep's settlement once the creating
    // request ends: model it by moving the clock past the pace window
    // WITHOUT firing the earlier call's pending timer. Time passes; the
    // dead promise never settles — and the later call must still fetch.
    vi.setSystemTime(new Date("2026-11-26T00:00:00Z"));
    let calls = 0;
    const api = createCatalogApi({
      baseUrl: "https://api.test/api/v1",
      paceMs: 350,
      fetchImpl: asFetch(async () => {
        calls++;
        return ok();
      }),
    });

    await api.coverage();
    expect(calls).toBe(1);

    vi.setSystemTime(new Date("2026-11-26T00:00:10Z"));
    const later = api.coverage();
    await flushMicrotasks();
    // RED on the promise-chain client: the later fetch never starts (1).
    expect(calls).toBe(2);
    await later;
  });
});
