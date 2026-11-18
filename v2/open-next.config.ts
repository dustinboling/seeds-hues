import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// X6: R2 incremental cache + D1 tag cache (not KV). Memory queue performs time-based ISR
// revalidation through the WORKER_SELF_REFERENCE service binding. See VERIFICATION-LOG V1.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
  queue: memoryQueue,
});
