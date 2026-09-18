export const CHAIN_CONFIG = {
  amoy: {
    id: 80002,
    name: "Polygon Amoy",
    shortName: "Amoy",
    rpc: "https://rpc-amoy.polygon.technology/",
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
  // Polygon Amoy — Redeployed 2026-09-18
  [CHAIN_CONFIG.amoy.id]: {
    digitalGoods: "0x756CF434FAB30A18117810B9dC3a8f7F68e891DB",
    freelancerEscrow: "0xb02cca2D8Fd71bE960f6C261EAD2f460dF8b0cBb",
    digitalRWA: "0xBCe3E78Cac1Dd60857880Eb833700ec09FcF2483",
    govToken: "0xFd919cE133d356bdeb0577e6b35b20b7caD69722",
    feeDistributor: "0x18F01543d6D1AF6f80E8624f17bc73666e43525e",
    userProfile: "0x6eFe1E8E77B7Fd4d55a61E7de2d6dd4799FC47d0",
    mockUSDC: "0x7b15CF801566053B6aDee1a497A8981C190b241B",
    mockUSDT: "0x0000000000000000000000000000000000000000",
    mockXNOBT: "0x0000000000000000000000000000000000000000",
    mockXBRT: "0x0000000000000000000000000000000000000000",
  },
  // Base Sepolia — Redeployed 2026-09-18
  [CHAIN_CONFIG.baseSepolia.id]: {
    digitalGoods: "0xe5665d1D2F180D27d328acCBB83f5fBE32A6666A",
    freelancerEscrow: "0x1a112d7D350976A7b5015868F4DF3bdC8A46570d",
    digitalRWA: "0xb0a742a2302B043718b60053b135dC432C892852",
    govToken: "0x612B5dda1BCBe17Dff554bb446A8018a574DBe37",
    feeDistributor: "0x4710d00AC3C2B6d0375F762076BDCE5ef835E64f",
    userProfile: "0x432aCe196DFD335396257e0CDF33B3f815b6fF0B",
    mockUSDC: "0xBF4588E207c2191Ee9D3f114370a6dbf4BACFFf3",
    mockUSDT: "0x0000000000000000000000000000000000000000",
    mockXNOBT: "0x0000000000000000000000000000000000000000",
    mockXBRT: "0x0000000000000000000000000000000000000000",
  },
  // Arbitrum Sepolia — Redeployed 2026-09-18
  [CHAIN_CONFIG.arbitrumSepolia.id]: {
    digitalGoods: "0xAe743AC8eBE1fe05114bB82F68b51A9a2BabD9Df",
    freelancerEscrow: "0x88fB6Ae65B2c6011F4dE243BbDa100dC57Cd5FE5",
    digitalRWA: "0x81C11612df53Bf2564CFDEc7C7E11407db6E10Ce",
    govToken: "0x0061E989c93c38aAd363a86e1AD66875A93226d7",
    feeDistributor: "0x0790bB1Ee4ee086C2610346E2290B38BC75Ac347",
    userProfile: "0x090AAe945842f7bf73533776B226B2979293f709",
    mockUSDC: "0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B",
    mockUSDT: "0x0000000000000000000000000000000000000000",
    mockXNOBT: "0x0000000000000000000000000000000000000000",
    mockXBRT: "0x0000000000000000000000000000000000000000",
  },
} as const;

export const DEFAULT_CHAIN = CHAIN_CONFIG.amoy.id;
