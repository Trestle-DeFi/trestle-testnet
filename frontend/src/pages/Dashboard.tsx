import { useState, useEffect } from "react";
import { useContracts } from "../hooks/useContracts";
import { getVaultBalance, getVaultTiers, type VirtualBalance, type StakingTier } from "../lib/vault";

export default function Dashboard() {
  const { address, isConnected } = useContracts();
  const [vault, setVault] = useState<VirtualBalance | null>(null);
  const [tiers, setTiers] = useState<StakingTier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      getVaultBalance(address),
      getVaultTiers(),
    ]).then(([bal, t]) => {
      setVault(bal);
      setTiers(t);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [address]);

  const activeTier = vault ? tiers[vault.staking_tier] : null;
  const hnobtDisplay = vault ? (BigInt(vault.virtual_hnobt) / 10n ** 18n).toString() : "0";
  const btrDisplay = vault ? (BigInt(vault.btr_claimable) / 10n ** 9n).toString() : "0";

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
        <p className="text-xs opacity-80">Virtual Vault Balance</p>
        {loading ? (
          <p className="text-lg font-bold mt-1">Loading...</p>
        ) : (
          <>
            <p className="text-lg font-bold mt-1">{hnobtDisplay} hNOBT</p>
            <p className="text-sm font-medium">{btrDisplay} BTR claimable</p>
            {vault?.staking_active ? (
              <p className="text-[10px] opacity-70 mt-1">Staking active — {activeTier?.label || ""}</p>
            ) : (
              <p className="text-[10px] opacity-70 mt-1">Staking inactive — stake to earn yield</p>
            )}
          </>
        )}
        {address && <p className="text-[10px] opacity-60 mt-2">{address.slice(0, 6)}...{address.slice(-4)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a href="/stake" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">📈</span>
          <h3 className="font-semibold text-sm mt-1">Stake</h3>
          <p className="text-[10px] text-gray-500">Lock hNOBT & earn BTR yield</p>
        </a>
        <a href="/tasks" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-sm mt-1">Tasks</h3>
          <p className="text-[10px] text-gray-500">Earn hNOBT points</p>
        </a>
        <a href="/verify" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">✅</span>
          <h3 className="font-semibold text-sm mt-1">Verify</h3>
          <p className="text-[10px] text-gray-500">Passport + biometric</p>
        </a>
        <a href="/withdraw" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">💰</span>
          <h3 className="font-semibold text-sm mt-1">Withdraw</h3>
          <p className="text-[10px] text-gray-500">Claim BTR rewards</p>
        </a>
      </div>
    </div>
  );
}
