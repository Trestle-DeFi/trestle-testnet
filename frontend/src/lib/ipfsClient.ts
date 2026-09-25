/**
 * Zero-API IPFS / Arweave gateway resolver.
 *
 * Reads back `ipfs://` and `ar://` URIs purely via public gateways.
 * No API keys, tokens, or third-party secrets are required.
 *
 * Gateways are tried sequentially (with short timeouts) so the user's
 * browser never hits a single point of failure — if the primary gateway
 * is down or blocked, the next one is attempted automatically.
 */

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.webstorage.dev/ipfs/",
  "https://4everland.io/ipfs/",
];

const ARWEAVE_GATEWAYS = ["https://arweave.net/", "https://gateway.bundlr.network/"];

/** Convert `ipfs://`, `ar://`, or bare CID/URL to gateway HTTPS URLs. */
function toGatewayUrls(uri: string): string[] {
  if (uri.length === 0) return [];
  const trimmed = uri.trim();

  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice("ipfs://".length);
    return IPFS_GATEWAYS.map((g) => `\${g}\${cid}`);
  }
  if (trimmed.startsWith("ipns://")) {
    const name = trimmed.slice("ipns://".length);
    return IPFS_GATEWAYS.map((g) => `\${g.replace("/ipfs/", "/ipns/")}\${name}`);
  }
  // Treat any plain HTTP(S) / existing gateway URLs (incl. gateway links) as-is.
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return [trimmed];
  }
  // Bare CID or hash fallback -> treat as an IPFS CID.
  return IPFS_GATEWAYS.map((g) => `\${g}\${trimmed}`);
}

function withTimeout(signal: AbortSignal, onTimeout: () => void) {
  const id = setTimeout(() => onTimeout(), 4000);
  signal.addEventListener("abort", () => clearTimeout(id));
}

/**
 * Fetch text content from a URI (ipfs://, ar://, https://...) using only
 * public gateways. Returns null if all gateways fail.
 */
export async function fetchUriText(uri: string): Promise<string | null> {
  const urls = toGatewayUrls(uri);
  if (urls.length === 0) return null;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      withTimeout(controller.signal, () => controller.abort());
      const res = await fetch(url, {
        method: "GET",
        mode: "cors",
        signal: controller.signal,
        headers: { Accept: "application/json, text/plain, */*" },
      });
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // try next gateway
    }
  }
  return null;
}

/**
 * Fetch & parse JSON from an IPFS/Arweave/HTTP URI.
 * Returns null when content is unavailable or not valid JSON.
 */
export async function fetchUriJson<T = any>(uri: string): Promise<T | null> {
    const text = await fetchUriText(uri);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Best-effort human-readable title derived from an IPFS JSON metadata blob.
 * Falls back to the raw URI when no title/description field is found.
 */
export async function resolveMetadataTitle(uri: string): Promise<string> {
  if (uri.length === 0) return "Untitled";
  const json = await fetchUriJson<{ title?: string; name?: string; description?: string }>(uri);
  if (json === null) {
    const cid = uri.replace("ipfs://", "").trim();
    if (cid && uri.startsWith("ipfs://")) return `\${cid.slice(0, 8)}…`;
    return uri;
  }
  const title = json.title || json.name || "";
  if (title.length > 0) return title;
  if (json.description) return json.description.slice(0, 60);
  const cid = uri.replace("ipfs://", "").trim();
  return cid ? `\${cid.slice(0, 8)}…` : uri;
}
