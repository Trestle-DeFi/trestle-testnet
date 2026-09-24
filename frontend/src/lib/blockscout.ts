import { CHAIN_CONFIG } from "../config/contracts";

const API_KEY = process.env.NEXT_PUBLIC_BLOCKSCOUT_API_KEY ?? "";
const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ?? "";
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";

// Chains without a public Blockscout instance (e.g. Polygon Amoy) fall back
// to the Etherscan V2 multichain API, which covers all supported chains.
function getChainIdParam(chainId: number): string {
  return String(chainId);
}

export function hasIndexer(chainId: number): boolean {
  return !!getBlockscoutUrl(chainId) || !!ETHERSCAN_KEY;
}

export function getBlockscoutUrl(chainId: number): string | null {
  for (const config of Object.values(CHAIN_CONFIG)) {
    if (config.id === chainId && "blockscout" in config) return (config as any).blockscout;
  }
  return null;
}

async function etherscanV2(params: Record<string, string>): Promise<any[] | null> {
  if (!ETHERSCAN_KEY) return null;
  try {
    const qs = new URLSearchParams({ ...params, apikey: ETHERSCAN_KEY });
    const r = await fetch(`${ETHERSCAN_V2}?${qs}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== "1" || !Array.isArray(j.result)) return null;
    return j.result;
  } catch { return null; }
}

export function getExplorerUrl(chainId: number): string {
  for (const config of Object.values(CHAIN_CONFIG)) {
    if (config.id === chainId) return config.explorer;
  }
  return "https://amoy.polygonscan.com";
}

async function api(chainId: number, path: string) {
  const baseUrl = getBlockscoutUrl(chainId);
  if (!baseUrl) return null;
  try {
    const r = await fetch(`${baseUrl}/api/v2${path}`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export interface BlockscoutTx {
  hash: string;
  timestamp: string;
  from: { hash: string };
  to: { hash: string } | null;
  value: string;
  fee: { value: string };
  status: "ok" | "error";
  method: string | null;
}

export interface BlockscoutTokenTransfer {
  tx_hash: string;
  timestamp: string;
  from: { hash: string };
  to: { hash: string };
  token: { name: string; symbol: string; decimals: string };
  total: { value: string };
}

export interface BlockscoutAddress {
  hash: string;
  coin_balance: string | null;
  token_balances: { token: { name: string; symbol: string; decimals: string }; value: string }[] | null;
}

export async function getTransactions(address: string, page = 0, chainId = 80002): Promise<BlockscoutTx[] | null> {
  const data = await api(chainId, `/addresses/${address}/transactions`);
  if (data && data.items) return data.items;
  // Etherscan V2 fallback (Amoy etc.)
  const rows = await etherscanV2({
    chainid: getChainIdParam(chainId),
    module: "account",
    action: "txlist",
    address,
    startblock: "0",
    endblock: "99999999",
    page: String(page + 1),
    offset: "10",
    sort: "desc",
  });
  if (!rows) return null;
  return rows.map((t: any) => ({
    hash: t.hash,
    timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
    from: { hash: t.from },
    to: t.to ? { hash: t.to } : null,
    value: t.value,
    fee: { value: String(BigInt(t.gasUsed || 0) * BigInt(t.gasPrice || 0)) },
    status: t.txreceipt_status === "1" ? ("ok" as const) : ("error" as const),
    method: t.functionName ? t.functionName.split("(")[0] : null,
  }));
}

export async function getTokenTransfers(address: string, chainId = 80002): Promise<BlockscoutTokenTransfer[] | null> {
  const data = await api(chainId, `/addresses/${address}/token-transfers`);
  if (data && data.items) return data.items;
  const rows = await etherscanV2({
    chainid: getChainIdParam(chainId), module: "account", action: "tokentx", address,
    page: "1", offset: "10", sort: "desc",
  });
  if (!rows) return null;
  return rows.map((t: any) => ({
    tx_hash: t.hash,
    timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
    from: { hash: t.from },
    to: { hash: t.to },
    token: { name: t.tokenName, symbol: t.tokenSymbol, decimals: t.tokenDecimal },
    total: { value: t.value },
  }));
}

export async function getAddressInfo(address: string, chainId = 80002): Promise<BlockscoutAddress | null> {
  const data = await api(chainId, `/addresses/${address}`);
  if (data && data.hash) return data;
  // Etherscan V2 fallback — native balance only.
  // (Per-token balances via addresstokenbalance are an Etherscan Pro endpoint.)
  const balRows = await etherscanV2({ chainid: getChainIdParam(chainId), module: "account", action: "balance", address });
  if (!balRows) return null;
  let coin_balance: string | null = null;
  try { coin_balance = BigInt(balRows[0]).toString(); } catch { coin_balance = null; }
  return { hash: address, coin_balance, token_balances: [] };
}

export function explorerTxUrl(chainId: number, hash: string) {
  return `${getExplorerUrl(chainId)}/tx/${hash}`;
}

export function explorerAddressUrl(chainId: number, address: string) {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}

export function rpcUrl(chainId: number) {
  for (const config of Object.values(CHAIN_CONFIG)) {
    if (config.id === chainId) return config.rpc;
  }
  return "https://polygon-amoy.drpc.org";
}

export function explorerUrl(chainId?: number) {
  if (chainId) {
    const url = getBlockscoutUrl(chainId);
    if (url) return url;
  }
  return "https://amoy.polygonscan.com";
}
