/**
 * Version-aware data cache — the request-time half of the invalidation story.
 *
 * Prerendered pages with live data (/, /crop) render through this cache: a
 * cold cache fetches live; a warm entry serves until its max age (the data
 * analogue of the plan's s-maxage=3600) or until the revalidate hook purges
 * it. Every entry records the page paths that render it, so the hook's
 * tag→paths fan-out purges exactly the entries behind the affected pages.
 *
 * In production the Worker keeps one cache per isolate and re-renders purged
 * paths on the next request (stale-while-revalidate at the edge covers the
 * gap); at build time the cache is cold and every entry loads live — the
 * first HTML always carries current data, never a snapshot.
 */

export interface CacheEntry<T> {
  value: T;
  /** The catalog_seq observed when the entry loaded (null when unknown). */
  catalogSeq: number | null;
  fetchedAt: number;
  /** Page paths whose render consumed this entry (purge routing). */
  paths: string[];
}

interface StoredEntry {
  entry: CacheEntry<unknown>;
  maxAgeMs: number;
}

export interface DataCache {
  get<T>(key: string, loader: () => Promise<{ value: T; catalogSeq?: number | null; paths: string[] }>, maxAgeMs?: number): Promise<T>;
  peek<T>(key: string): CacheEntry<T> | null;
  invalidatePaths(paths: string[]): string[];
  /**
   * Every path registered by an entry one of the given paths would purge
   * (the entries' own pages plus their related-entity pages — e.g. the
   * variety pages behind a purged seller entry). The edge purge deletes
   * these alongside the tag's own paths, so a one-tag revalidate drops
   * every affected page even though the tag names only its own.
   */
  relatedPaths(paths: string[]): string[];
  invalidateAll(): void;
  size(): number;
}

/** Default entry lifetime: the plan's s-maxage=3600, in ms. */
export const DEFAULT_ENTRY_MAX_AGE_MS = 3_600_000;

export function createDataCache(now: () => number = Date.now): DataCache {
  const entries = new Map<string, StoredEntry>();

  const fresh = (stored: StoredEntry): boolean => now() - stored.entry.fetchedAt < stored.maxAgeMs;

  return {
    async get<T>(
      key: string,
      loader: () => Promise<{ value: T; catalogSeq?: number | null; paths: string[] }>,
      maxAgeMs: number = DEFAULT_ENTRY_MAX_AGE_MS,
    ): Promise<T> {
      const hit = entries.get(key);
      if (hit && fresh(hit)) return hit.entry.value as T;
      const loaded = await loader();
      entries.set(key, {
        entry: { value: loaded.value, catalogSeq: loaded.catalogSeq ?? null, fetchedAt: now(), paths: [...loaded.paths] },
        maxAgeMs,
      });
      return loaded.value;
    },
    peek<T>(key: string): CacheEntry<T> | null {
      const hit = entries.get(key);
      if (!hit || !fresh(hit)) return null;
      return hit.entry as CacheEntry<T>;
    },
    /**
     * Drop every entry rendered into one of the given paths. Returns the
     * purged keys (the hook reports them; the edge purge uses the paths).
     */
    invalidatePaths(paths: string[]): string[] {
      const wanted = new Set(paths);
      const purged: string[] = [];
      for (const [key, stored] of entries) {
        if (stored.entry.paths.some((p) => wanted.has(p))) {
          entries.delete(key);
          purged.push(key);
        }
      }
      return purged.sort();
    },
    relatedPaths(paths: string[]): string[] {
      const wanted = new Set(paths);
      const out = new Set<string>();
      for (const stored of entries.values()) {
        if (stored.entry.paths.some((p) => wanted.has(p))) {
          for (const p of stored.entry.paths) out.add(p);
        }
      }
      return [...out].sort();
    },
    invalidateAll(): void {
      entries.clear();
    },
    size(): number {
      return entries.size;
    },
  };
}
