import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// DOM tests share one jsdom document per file; unmount after each test so
// queries never see a previous test's render.
afterEach(() => {
  cleanup();
});
