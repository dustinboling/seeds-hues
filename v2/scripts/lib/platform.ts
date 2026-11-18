/**
 * Node-side access to the Worker bindings for data scripts, via Wrangler's platform proxy
 * (Miniflare). Local by default — the same `.wrangler/state/v3` store that `wrangler dev`,
 * `next dev` (initOpenNextCloudflareForDev) and `wrangler d1 … --local` use.
 *
 * Remote: pass `--remote --config <file>` where <file> is a Wrangler config whose DB/SNAPSHOTS
 * bindings carry real ids and `"remote": true` (README "Production data operations").
 */
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";

export interface ScriptArgs {
  flags: Set<string>;
  values: Map<string, string>;
}

export function parseArgs(argv = process.argv.slice(2)): ScriptArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=", 2) as [string, string | undefined];
    if (inline !== undefined) values.set(k, inline);
    else if (argv[i + 1] && !argv[i + 1]!.startsWith("--")) values.set(k, argv[++i]!);
    else flags.add(k);
  }
  return { flags, values };
}

export async function openPlatform(args: ScriptArgs) {
  const persistTo = args.values.get("persist-to");
  const remote = args.flags.has("remote");
  const proxy = await getPlatformProxy<CloudflareEnv>({
    configPath: args.values.get("config") ?? "wrangler.jsonc",
    // Same semantics as `wrangler … --persist-to <dir>` (Wrangler stores state under <dir>/v3).
    persist: persistTo ? { path: join(persistTo, "v3") } : true,
    remoteBindings: remote,
  });
  return proxy;
}
