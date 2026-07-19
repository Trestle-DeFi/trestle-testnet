export const API_BASE = import.meta.env.VITE_API_URL || "https://reward-api.trestle.website";
export const VAULT_API_BASE = import.meta.env.VITE_VAULT_API_URL || "https://vault.trestle.website";
export const AI_API_BASE = import.meta.env.VITE_AI_API_URL || "https://ai.trestle.website";

export const LINKS = {
  mainSite: import.meta.env.VITE_MAIN_SITE_URL || "https://trestle.website",
  testnet: import.meta.env.VITE_TESTNET_URL || "https://testnet.trestle.website",
  docs: "https://docs.trestle.website",
  telegram: "https://t.me/TrestleDeFi",
  discord: "https://discord.gg/4dCCvnJYGT",
  github: "https://github.com/Trestle-DeFi",
} as const;

export const CHAIN_CONFIG = {
  amoy: {
    id: 80002,
    name: "Polygon Amoy",
    rpc: "https://rpc-amoy.polygon.technology/",
    explorer: "https://www.oklink.com/amoy",
    currency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  polygon: {
    id: 137,
    name: "Polygon Mainnet",
    rpc: "https://polygon-rpc.com/",
    explorer: "https://polygonscan.com/",
    currency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
} as const;

export const BROILER_INFO = {
  supply: "1,000,000,000,000,000",
  supplyDisplay: "1 Quadrillion",
  taxBps: 500,
  taxPercent: 5,
  recommendedSlippage: "6-7%",
  lpPair: "BRT/WMATIC",
} as const;

export const STAKING_DURATIONS = [
  { id: 0, label: "3 Months", seconds: 90 * 86400, multiplier: "1x" },
  { id: 1, label: "6 Months", seconds: 180 * 86400, multiplier: "1.5x" },
  { id: 2, label: "12 Months", seconds: 365 * 86400, multiplier: "2x" },
] as const;
