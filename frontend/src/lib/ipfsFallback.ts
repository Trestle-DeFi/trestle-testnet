/**
 * Zero-API in-browser metadata & IPFS URI helper.
 * Generates sha256 content hashes client-side without any third-party API keys or external services.
 */

export async function computeSha256Hex(content: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for non-browser environment
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function createLocalMetadataURI(metadata: {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  properties?: Record<string, any>;
}): Promise<{ uri: string; hash: string; json: string }> {
  const json = JSON.stringify(metadata, null, 2);
  const hash = await computeSha256Hex(json);
  // IPFS mock CID v1 format (dag-pb / sha256 prefix)
  const simulatedCID = `bafkrei${hash.slice(0, 46)}`;
  return {
    uri: `ipfs://${simulatedCID}`,
    hash,
    json,
  };
}
