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
  // Polygon Amoy — Redeployed 2026-11-04 (full redeploy with migration/wiring fixes)
  [CHAIN_CONFIG.amoy.id]: {
    digitalGoods: "0x904B176AbDb890efCE94A900ec58ac6ba5542ddE",
    freelancerEscrow: "0x797C5F47C08779bacA98F6f98E9148b4bb0c1FCb",
    digitalRWA: "0x3Ca20bF33BCaab77102E5DA6819c682a73a7cc5b",
    govToken: "0x539ba8F7905524c2e9d844890693C4d723B6731B",
    feeDistributor: "0x4104eA3D55F9C2F5818671e5365F801996D83038",
    userProfile: "0x539ba8F7905524c2e9d844890693C4d723B6731B",
    mockUSDC: "0x7D31806d5AD7deB103bf42156bBfd371dA409192",
    mockUSDT: "0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6",
    mockXNOBT: "0xfA1D7652bbE1502Da70ca2ecd01E912f21fcc053",
    mockXBRT: "0x92f8833E6F04b5e42c498d6880f1827a5d198D36",
  },
  // Base Sepolia — Redeployed 2026-11-04 (full redeploy with migration/wiring fixes)
  [CHAIN_CONFIG.baseSepolia.id]: {
    digitalGoods: "0x975C9fFA819f6057d9515CC17c93bcE52BCA8BED",
    freelancerEscrow: "0x50a354b985b6c68C8f2288a28354b9885E01C4F5",
    digitalRWA: "0x1D1dA38eb1F28b6728ef7538d2A2de4D5a299f83",
    govToken: "0x0bd00b1134bad04117e14c36D1055Ce6c1d8570D",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    userProfile: "0x0bd00b1134bad04117e14c36D1055Ce6c1d8570D",
    mockUSDC: "0xB836A5627E3c1dd9b7602259E28AA433bfb8c1cC",
    mockUSDT: "0x2Ccd7Ef357e377350724aaE2b4494Ca55756d526",
    mockXNOBT: "0xB4149c73906ced8569f47f9B7cC86e6f3fA115cf",
    mockXBRT: "0x0b23537D84225efEd85633DDcDE108eCE1A31b40",
  },
  // Arbitrum Sepolia — Redeployed 2026-11-04 (full redeploy with migration/wiring fixes)
  [CHAIN_CONFIG.arbitrumSepolia.id]: {
    digitalGoods: "0xD0535723f2E33A8d6d05FDA33Ea85cDbCaea8EF5",
    freelancerEscrow: "0x7D31806d5AD7deB103bf42156bBfd371dA409192",
    digitalRWA: "0x013Af09898e4B946e79553bCDaf875872bc73A6d",
    govToken: "0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    userProfile: "0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6",
    mockUSDC: "0x907EAd771eB0fB1BCC708c1E49B5881d5AC26C25",
    mockUSDT: "0xa85E2c21d403F6AADe6767dDDEa1056BA9942cD1",
    mockXNOBT: "0xbe6E05767e64a413E7d335d226a6B6d0BA6F5ed0",
    mockXBRT: "0xe6E45bc1719B58DB52c192667892C7dD32b1CDd7",
  },
} as const;

export const DEFAULT_CHAIN = CHAIN_CONFIG.amoy.id;
