import { useEffect, useState } from "react";
import { fetchUriJson, resolveMetadataTitle } from "../lib/ipfsClient";

/**
 * Client-side React hook that resolves an IPFS/Arweave URI into JSON.
 * Pure browser fetch — no API keys, no backend required.
 */
export function useIpfsJson<T = any>(uri: string | undefined) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const input = uri || "";
    if (!input) {
      setData(null);
      setLoading(false);
      return;
    }
    // Skip network fetch for already-readable plain HTTP(S) data/json.
    if (input.startsWith("data:")) {
      try {
        const json = JSON.parse(decodeURIComponent(input.split(",")[1]));
        if (!cancelled) setData(json as T);
      } catch {
        if (!cancelled) setError("invalid data URI");
      }
      return;
    }

    setLoading(true);
    fetchUriJson<T>(input)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(result == null ? "unavailable" : null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("fetch failed");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return { data, loading, error };
}

/** Resolve a readable title for an ipfs:// / ar:// / https:// URI. */
export function useIpfsTitle(uri: string | undefined) {
  const [title, setTitle] = useState<string>(uri || "Untitled");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const input = uri || "";
    if (!input) {
      setTitle("Untitled");
      return;
    }
    setLoading(true);
    resolveMetadataTitle(input).then((t) => {
      if (!cancelled) {
        setTitle(t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return { title, loading };
}
