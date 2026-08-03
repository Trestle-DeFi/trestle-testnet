import { useState, useEffect } from "react";
import { useContracts } from "../hooks/useContracts";
import { useAuth } from "../hooks/useAuth";
import { getUserStats, getGlobalStats, type UserStats, type GlobalStats } from "../lib/reward";
import { getChainStatus } from "../lib/testnet";

export default function Dashboard() {
  const { isConnected, chainId, chainName, address } = useContracts();
  const { displayAddress } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [chains, setChains] = useState<Record<number, { name: string; blockNumber: number; connected: boolean }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getGlobalStats().then(setGlobalStats).catch(() => {}).finally(() => setLoading(false));
    getChainStatus().then(setChains).catch(() => {});
  }, []);

  useEffect(() => {
    if (!displayAddress) return;
    getUserStats(displayAddress).then(setUserStats).catch(() => {});
  }, [displayAddress]);

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">🔐</div>
        <p className="text-gray-500">Connect wallet to view dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
        <p className="text-xs opacity-80">Your Rewards</p>
        {userStats ? (
          <>
            <p className="text-lg font-bold mt-1">{userStats.total_earned} hNOBT</p>
            <div className="flex gap-4 mt-2 text-xs opacity-80">
              <span>Streak: {userStats.streak}</span>
              <span>Tasks: {userStats.tasks_completed}</span>
            </div>
          </>
        ) : (
          <p className="text-lg font-bold mt-1">{loading ? "Loading..." : "0 hNOBT"}</p>
        )}
        {address && <p className="text-[10px] opacity-60 mt-2">{address.slice(0, 6)}...{address.slice(-4)}</p>}
      </div>

      {globalStats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] text-gray-500">Users</p>
            <p className="text-sm font-bold">{globalStats.total_users}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] text-gray-500">Distributed</p>
            <p className="text-sm font-bold">{Number(globalStats.total_rewards_distributed).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] text-gray-500">Tasks</p>
            <p className="text-sm font-bold">{globalStats.active_tasks}</p>
          </div>
        </div>
      )}

      {Object.keys(chains).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-sm mb-2">Chains</h3>
          <div className="space-y-2">
            {Object.entries(chains).map(([id, info]) => (
              <div key={id} className="flex items-center justify-between text-xs">
                <span>{info.name}</span>
                <span className={info.connected ? "text-emerald-600" : "text-red-500"}>
                  {info.connected ? "Connected" : "Offline"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <a href="/tasks" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-sm mt-1">Tasks</h3>
          <p className="text-[10px] text-gray-500">Earn hNOBT points</p>
        </a>
        <a href="/marketplace" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">🛒</span>
          <h3 className="font-semibold text-sm mt-1">Marketplace</h3>
          <p className="text-[10px] text-gray-500">Buy & sell on testnet</p>
        </a>
        <a href="/bounty" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">🎯</span>
          <h3 className="font-semibold text-sm mt-1">Bug Bounty</h3>
          <p className="text-[10px] text-gray-500">Report & earn rewards</p>
        </a>
        <a href="/stake" className="block p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
          <span className="text-lg">📈</span>
          <h3 className="font-semibold text-sm mt-1">Stake</h3>
          <p className="text-[10px] text-gray-500">Lock hNOBT & earn</p>
        </a>
      </div>
    </div>
  );
}
