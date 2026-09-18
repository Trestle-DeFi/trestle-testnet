# Trestle DeFi — Smart Contracts

Hardhat project with Solidity smart contracts for the Trestle DeFi Marketplace.

## Contracts

| Contract | Description | Security |
|----------|-------------|----------|
| `DigitalRWA.sol` | RWA tokenization — Chainlink price feed, USDC-gated whitelist, mint/subscribe | nonReentrant, custom errors, zero-address guards |
| `DigitalGoods.sol` | Marketplace — fixed-price + Dutch auction, delivery flow, dispute resolution | Custom errors, zero-address validation |
| `FreelancerEscrow.sol` | Freelance escrow — fixed/Dutch budget, milestones, gig marketplace, auto-approve | nonReentrant on all state-changing functions, custom errors |
| `FeeDistributor.sol` | 40/40/20 fee split (treasury/yield/buyback-burn), ETH + ERC20 | Custom errors |
| `UserProfile.sol` | On-chain profiles + token-gated reviews with cooldown | Custom errors, zero-address guard |
| `MockGovernanceToken.sol` | ERC-20 governance token (tGOV) for whitelisting | Used by DigitalRWA |
| `MockERC20.sol` | Generic mock ERC-20 for testing (USDC, USDT, xNOBT, xBRT) | — |

## Deployed — Base Sepolia (84532) — All verified (post-fix)

| Contract | Address | Explorer |
|----------|---------|----------|
| MockGovernanceToken | `0x612B5dda1BCBe17Dff554bb446A8018a574DBe37` | [View](https://sepolia.basescan.org/address/0x612B5dda1BCBe17Dff554bb446A8018a574DBe37#code) |
| FeeDistributor | `0x4710d00AC3C2B6d0375F762076BDCE5ef835E64f` | [View](https://sepolia.basescan.org/address/0x4710d00AC3C2B6d0375F762076BDCE5ef835E64f#code) |
| DigitalGoods | `0xe5665d1D2F180D27d328acCBB83f5fBE32A6666A` | [View](https://sepolia.basescan.org/address/0xe5665d1D2F180D27d328acCBB83f5fBE32A6666A#code) |
| FreelancerEscrow | `0x1a112d7D350976A7b5015868F4DF3bdC8A46570d` | [View](https://sepolia.basescan.org/address/0x1a112d7D350976A7b5015868F4DF3bdC8A46570d#code) |
| DigitalRWA | `0xb0a742a2302B043718b60053b135dC432C892852` | [View](https://sepolia.basescan.org/address/0xb0a742a2302B043718b60053b135dC432C892852#code) |
| UserProfile | `0x432aCe196DFD335396257e0CDF33B3f815b6fF0B` | [View](https://sepolia.basescan.org/address/0x432aCe196DFD335396257e0CDF33B3f815b6fF0B#code) |
| Mock USDC | `0xBF4588E207c2191Ee9D3f114370a6dbf4BACFFf3` | [View](https://sepolia.basescan.org/address/0xBF4588E207c2191Ee9D3f114370a6dbf4BACFFf3#code) |

**RWA pricing:** Chainlink testnet feed proxies are deprecated (Shutdown Policy); price set via admin `setManualPrice()` ($3000 ETH/USD). `syncPrice()` remains primary if a live feed returns.

## Deployed — Arbitrum Sepolia (421614) — All verified (post-fix)

| Contract | Address | Explorer |
|----------|---------|----------|
| MockGovernanceToken | `0x0061E989c93c38aAd363a86e1AD66875A93226d7` | [View](https://sepolia.arbiscan.io/address/0x0061E989c93c38aAd363a86e1AD66875A93226d7#code) |
| FeeDistributor | `0x0790bB1Ee4ee086C2610346E2290B38BC75Ac347` | [View](https://sepolia.arbiscan.io/address/0x0790bB1Ee4ee086C2610346E2290B38BC75Ac347#code) |
| DigitalGoods | `0xAe743AC8eBE1fe05114bB82F68b51A9a2BabD9Df` | [View](https://sepolia.arbiscan.io/address/0xAe743AC8eBE1fe05114bB82F68b51A9a2BabD9Df#code) |
| FreelancerEscrow | `0x88fB6Ae65B2c6011F4dE243BbDa100dC57Cd5FE5` | [View](https://sepolia.arbiscan.io/address/0x88fB6Ae65B2c6011F4dE243BbDa100dC57Cd5FE5#code) |
| DigitalRWA | `0x81C11612df53Bf2564CFDEc7C7E11407db6E10Ce` | [View](https://sepolia.arbiscan.io/address/0x81C11612df53Bf2564CFDEc7C7E11407db6E10Ce#code) |
| UserProfile | `0x090AAe945842f7bf73533776B226B2979293f709` | [View](https://sepolia.arbiscan.io/address/0x090AAe945842f7bf73533776B226B2979293f709#code) |
| Mock USDC | `0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B` | [View](https://sepolia.arbiscan.io/address/0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B#code) |

**RWA pricing:** manual `setManualPrice()` fallback ($3000 ETH/USD) — no classic Chainlink feeds remain on this testnet.

## Deployed — Polygon Amoy (80002) — All verified (post-fix)

| Contract | Address | Explorer |
|----------|---------|----------|
| MockGovernanceToken | `0xFd919cE133d356bdeb0577e6b35b20b7caD69722` | [View](https://amoy.polygonscan.com/address/0xFd919cE133d356bdeb0577e6b35b20b7caD69722#code) |
| FeeDistributor | `0x18F01543d6D1AF6f80E8624f17bc73666e43525e` | [View](https://amoy.polygonscan.com/address/0x18F01543d6D1AF6f80E8624f17bc73666e43525e#code) |
| DigitalGoods | `0x756CF434FAB30A18117810B9dC3a8f7F68e891DB` | [View](https://amoy.polygonscan.com/address/0x756CF434FAB30A18117810B9dC3a8f7F68e891DB#code) |
| FreelancerEscrow | `0xb02cca2D8Fd71bE960f6C261EAD2f460dF8b0cBb` | [View](https://amoy.polygonscan.com/address/0xb02cca2D8Fd71bE960f6C261EAD2f460dF8b0cBb#code) |
| DigitalRWA | `0xBCe3E78Cac1Dd60857880Eb833700ec09FcF2483` | [View](https://amoy.polygonscan.com/address/0xBCe3E78Cac1Dd60857880Eb833700ec09FcF2483#code) |
| UserProfile | `0x6eFe1E8E77B7Fd4d55a61E7de2d6dd4799FC47d0` | [View](https://amoy.polygonscan.com/address/0x6eFe1E8E77B7Fd4d55a61E7de2d6dd4799FC47d0#code) |
| Mock USDC | `0x7b15CF801566053B6aDee1a497A8981C190b241B` | [View](https://amoy.polygonscan.com/address/0x7b15CF801566053B6aDee1a497A8981C190b241B#code) |

**RWA pricing:** manual `setManualPrice()` fallback ($0.20 POL/USD) — POL/USD feed sunset; only ETH/USD remains (wrong asset for native deposits).

## Supported Networks

| Network | Chain ID | Native | RPC | Status |
|---------|----------|--------|-----|--------|
| Polygon Amoy | 80002 | POL | `https://polygon-amoy-bor-rpc.publicnode.com` | Deployed |
| Base Sepolia | 84532 | ETH | `https://sepolia.base.org` | Deployed |
| Arbitrum Sepolia | 421614 | ETH | `https://sepolia-rollup.arbitrum.io/rpc` | Deployed |
| Polygon PoS | 137 | POL | `https://polygon-rpc.com/` | Configured |
| Base Mainnet | 8453 | ETH | `https://mainnet.base.org` | Configured |
| Arbitrum One | 42161 | ETH | `https://arb1.arbitrum.io/rpc` | Configured |

## Setup

```bash
npm install
cp .env.example .env   # add PRIVATE_KEY, RPC URLs, ETHERSCAN_API_KEY
npx hardhat compile
npx hardhat test
```

## Deploy

Deployment follows a resumable pipeline strategy (health-checked dual RPC endpoints, per-chain checkpointing). RWA-only redeployments: `scripts/redeploy-rwa.js` (deploy + whitelist + oracle-first/manual-price + auto-verify).

```bash
# Deploy to Base Sepolia
npx hardhat run scripts/deploy.js --network baseSepolia

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/deploy.js --network arbitrumSepolia

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.js --network amoy

# Deploy to Base Mainnet
npx hardhat run scripts/deploy.js --network base
```

The deploy script auto-detects chain ID and selects the correct:
- Native token symbol (ETH / POL)
- Chainlink ETH/USD price feed address
- Block explorer for verification

## Security

- `nonReentrant` on every external function that makes external calls; pure-storage creation/listing functions (`listFixed`, `listDutch`, `createProject*`, `createGig`, `updateGig`, `cancelGig`) don't need it and don't carry it
- Custom errors instead of require strings (gas-efficient)
- Zero-address validation in constructors
- Access control via `Ownable` + `AccessControl` roles
- Pausable contracts (DigitalRWA)
- Token-gated whitelist (DigitalRWA — requires USDC balance, swappable via `setWhitelistToken()`, capped at `MAX_WHITELIST_TOKENS`)
- Oracle: dynamic feed decimals in `subscribe()`, staleness checks, and a ≤20% per-sync price-deviation guard
- Audited 2026-09-18 — see `../AUDIT-REPORT.md` (original audit + 3 addenda); 15 findings fixed with regression tests in `test/AuditPoC.t.sol` (Foundry) and the Hardhat suite

## Architecture

```
contracts/
├── src/
│   ├── DigitalRWA.sol          # RWA tokenization + Chainlink oracle
│   ├── DigitalGoods.sol        # Marketplace (fixed + Dutch auction)
│   ├── FreelancerEscrow.sol    # Freelance escrow + gig marketplace
│   ├── FeeDistributor.sol      # 40/40/20 fee split
│   ├── UserProfile.sol         # On-chain profiles + reviews
│   └── mocks/
│       ├── MockGovernanceToken.sol
│       ├── MockERC20.sol
│       └── MockV3Aggregator.sol
├── scripts/
│   ├── deploy.js               # Full deploy with mock stablecoins
│   ├── redeploy-rwa.js         # RWA-only redeploy + config + verify
│   ├── verify_live.js          # On-chain live-config checks
│   └── e2e_amoy.js             # Amoy end-to-end flow
├── test/
│   ├── Heavy.test.js           # 94 security-focused tests
│   ├── TrestleProtocol.test.js # 38 integration tests
│   └── Yield.test.js           # 5 ERC-4626 yield tests
└── hardhat.config.js           # Multi-network config
```
