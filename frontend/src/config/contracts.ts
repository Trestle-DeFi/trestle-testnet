export const API_BASE = import.meta.env.VITE_API_URL || "https://reward.trestle.website";
export const VAULT_API_BASE = import.meta.env.VITE_VAULT_API_URL || "https://vault.trestle.website";

export const LINKS = {
  mainSite: import.meta.env.VITE_MAIN_SITE_URL || "https://trestle.website",
  testnet: import.meta.env.VITE_TESTNET_URL || "https://testnet.trestle.website",
  rewardSite: import.meta.env.VITE_REWARD_SITE_URL || "https://reward.trestle.website",
  vaultSite: import.meta.env.VITE_VAULT_SITE_URL || "https://vault.trestle.website",
  docs: "https://docs.trestle.website",
  telegram: "https://t.me/TrestleDeFi",
  discord: "https://discord.gg/4dCCvnJYGT",
  github: "https://github.com/Trestle-DeFi",
} as const;

export const CONTRACT_ADDRESSES = {
  amoy: {
    marketplaceCore: import.meta.env.VITE_MARKETPLACE_CORE ?? "0x6DdDbF0DD813C5c6EA2b3EC2d479E25132bbE14D",
    digitalGoods: import.meta.env.VITE_DIGITAL_GOODS ?? "0xf58fbEC439918Bd9e636AC1363e4FF2C0DD8b648",
    freelancerEscrow: import.meta.env.VITE_FREELANCER_ESCROW ?? "0x1A1956BF7Ac3f759169C1310fdB5E30209238e03",
    digitalRWA: import.meta.env.VITE_DIGITAL_RWA ?? "0xB2225f2e9a26688D43bC01A8Cf7aD4B179154c47",
    feeDistributor: import.meta.env.VITE_FEE_DISTRIBUTOR ?? "0x4CA2905Bf5421F3A743B4D72647005DF1e4235e8",
    hNOBT: "0xcF51ab7398315DbA6588Aa7fb3Df7c99D3D1F4dD",
    broilerPlus: "0xeCb4cAc0C9e5cBd42a9Ed36467ce8f96072AD58b",
    brtLp: "0xc445b18b3ff85e0691fe416ad91e456f8697b166",
    gnosisSafe: "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6",
  },
  polygon: {
    hNOBT: "0xcF51ab7398315DbA6588Aa7fb3Df7c99D3D1F4dD",
    broilerPlus: "0xeCb4cAc0C9e5cBd42a9Ed36467ce8f96072AD58b",
    brtLp: "0xc445b18b3ff85e0691fe416ad91e456f8697b166",
    gnosisSafe: "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6",
  },
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
  miningAllocation: {
    lpMining: { pct: 60, label: "Broiler LP Mining" },
    team: { pct: 24, label: "Team & Future Employees" },
    community: { pct: 10, label: "Community / Airdrop" },
    bugBounty: { pct: 5, label: "Bug Bounty" },
    advisors: { pct: 1, label: "Advisors" },
  },
} as const;

export const STAKING_DURATIONS = [
  { id: 0, label: "3 Months", seconds: 90 * 86400, multiplier: "1x" },
  { id: 1, label: "6 Months", seconds: 180 * 86400, multiplier: "1.5x" },
  { id: 2, label: "12 Months", seconds: 365 * 86400, multiplier: "2x" },
] as const;
