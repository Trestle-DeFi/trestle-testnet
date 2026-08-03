import { useState, useEffect } from "react";
import { useContracts } from "../hooks/useContracts";
import { getListings, type Listing } from "../lib/testnet";
import { LINKS } from "../config/contracts";
import { formatEther } from "viem";

const PRICING_LABELS: Record<number, string> = {
  0: "Fixed",
  1: "Dutch Auction",
};

const STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Sold",
  2: "Cancelled",
  3: "Disputed",
  4: "Refunded",
};

export default function Marketplace() {
  const { isConnected, isCorrectChain, chainId, explorer } = useContracts();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    getListings(chainId)
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [chainId]);

  const filtered = filter === "all" ? listings : listings.filter(l => {
    if (filter === "active") return l.status === 0;
    if (filter === "fixed") return l.pricing === 0;
    if (filter === "dutch") return l.pricing === 1;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Marketplace</h2>
        <a
          href={LINKS.testnet}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-600 hover:underline"
        >
          Open Testnet Hub →
        </a>
      </div>

      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-center">
          Connect wallet to buy listings. Browse freely below.
        </div>
      )}

      {isConnected && !isCorrectChain && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-xs text-red-700">Switch to a supported testnet to buy listings.</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "all", label: "All" },
          { id: "active", label: "Active" },
          { id: "fixed", label: "Fixed" },
          { id: "dutch", label: "Dutch" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              filter === f.id ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading listings...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
          <p className="text-sm">No listings yet — be the first!</p>
          <a
            href={LINKS.testnet}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-emerald-600 hover:underline"
          >
            Create listing on Testnet Hub →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(listing => (
            <div key={listing.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm">Listing #{listing.id}</h4>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      listing.status === 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {STATUS_LABELS[listing.status] || "Unknown"}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {PRICING_LABELS[listing.pricing] || "Unknown"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{listing.metadataURI}</p>
                  {listing.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 mt-1 inline-block">
                      {listing.category}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatEther(BigInt(listing.price))} POL
                  </p>
                  {listing.seller && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                    </p>
                  )}
                </div>
              </div>
              {listing.status === 0 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {listing.seller ? `Seller: ${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}` : ""}
                  </span>
                  {isConnected && isCorrectChain ? (
                    <a
                      href={`${explorer}/address/${listing.seller}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
                    >
                      View Seller
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Connect to interact</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
