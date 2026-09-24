export const CHAIN_CONFIG = {
  amoy: {
    id: 80002,
    name: "Polygon Amoy",
    shortName: "Amoy",
    rpc: "https://polygon-amoy.drpc.org",
    explorer: "https://amoy.polygonscan.com",
    currency: { name: "POL", symbol: "POL", decimals: 18 },
  },
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    shortName: "Base",
    rpc: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
    blockscout: "https://base-sepolia.blockscout.com",
  },
  arbitrumSepolia: {
    id: 421614,
    name: "Arbitrum Sepolia",
    shortName: "Arbitrum",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
    blockscout: "https://arbitrum-sepolia.blockscout.com",
  },
} as const;

export type ChainKey = keyof typeof CHAIN_CONFIG;
export const SUPPORTED_CHAIN_IDS = Object.values(CHAIN_CONFIG).map(c => c.id) as readonly number[];

export const CONTRACT_ADDRESSES: Record<number, {
  digitalGoods: `0x${string}`;
  freelancerEscrow: `0x${string}`;
  digitalRWA: `0x${string}`;
  govToken: `0x${string}`;
  feeDistributor: `0x${string}`;
  userProfile: `0x${string}`;
  mockUSDC: `0x${string}`;
  mockUSDT: `0x${string}`;
  mockXNOBT: `0x${string}`;
  mockXBRT: `0x${string}`;
}> = {
  // Polygon Amoy — Redeployed 2026-09-25 (all verified)
  [CHAIN_CONFIG.amoy.id]: {
    digitalGoods: "0xBd124c4395b47093CEc78497ec8b098977416396",
    freelancerEscrow: "0x7007DC17282316676c5d1Eb085D3CeC993f92193",
    digitalRWA: "0x7f750E8BD9c9C2685710A03De5307961BC50aF31",
    govToken: "0x7f411bA9824513a95C591A061F97A0A375B2cB71",
    feeDistributor: "0x4104eA3D55F9C2F5818671e5365F801996D83038",
    userProfile: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    mockUSDC: "0xBD551EE22321B500AB171885eb77574943aB65E1",
    mockUSDT: "0x0000000000000000000000000000000000000000",
    mockXNOBT: "0x0000000000000000000000000000000000000000",
    mockXBRT: "0x0000000000000000000000000000000000000000",
  },
  // Base Sepolia — Redeployed 2026-09-24 (all verified)
  [CHAIN_CONFIG.baseSepolia.id]: {
    digitalGoods: "0x89f5394a468343F405285040664Fd77843D2a2e6",
    freelancerEscrow: "0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B",
    digitalRWA: "0x5582496273a71E60e457D19773050CC848A2F52C",
    govToken: "0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    userProfile: "0xa1889d658601c7fA649a70516341fF4aac761ca8",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
    mockUSDT: "0x0000000000000000000000000000000000000000",
    mockXNOBT: "0x0000000000000000000000000000000000000000",
    mockXBRT: "0x0000000000000000000000000000000000000000",
  },
  // Arbitrum Sepolia — Redeployed 2026-09-24
  [CHAIN_CONFIG.arbitrumSepolia.id]: {
    digitalGoods: "0x6D6C679279f5C680e5a6ef33306F2e9A78577DCa",
    freelancerEscrow: "0x58E3B6f2eFD7F3ee4afe98A754e155DBE9052513",
    digitalRWA: "0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D",
    govToken: "0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    userProfile: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
    mockUSDT: "0x0000000000000000000000000000000000000000",
    mockXNOBT: "0x0000000000000000000000000000000000000000",
    mockXBRT: "0x0000000000000000000000000000000000000000",
  },
} as const;

export const DEFAULT_CHAIN = CHAIN_CONFIG.amoy.id;
