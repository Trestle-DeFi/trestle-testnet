# testnet.trestle.website

---

**Legal Disclaimer:** Trestle DeFi (trestle.website) is an independent Web3 ecosystem operating exclusively on the Polygon network. We are not affiliated, associated, authorized, endorsed by, or in any way officially connected with the Celestia-based "Trestle Protocol" bridge project or any of its subsidiaries.

Testnet platform for Trestle DeFi. Smart contracts deployed on **Polygon Amoy**, **Base Sepolia**, and **Arbitrum Sepolia**, with a Next.js frontend.

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| **DigitalGoods** | Marketplace listings — fixed-price & Dutch auction with description, tags, and NFT flag |
| **FreelancerEscrow** | Milestone-based gigs & projects (GitHub, portfolio, category, min-budget, duration) |
| **DigitalRWA** | Tokenized real-world assets, whitelist-gated (token type, jurisdiction, issuer, risk level) |
| **FeeDistributor** | Fee splitting (yield vault / treasury / buyback), reentrancy-guarded |
| **GovernanceToken** | Mock governance token (tGOV) |
| **MockUSDC / MockUSDT** | Test stablecoins (6 decimals) |
| **MockXNOBT / MockXBRT** | Test tokens (18 decimals) |
| **UserProfile** | On-chain profiles (all fields optional, incl. socials) & reviews |

Deployed addresses are maintained in `frontend/src/config/contracts.ts` (`CONTRACT_ADDRESSES`).

### Base Sepolia Deployments (latest — all verified)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0xe5665d1D2F180D27d328acCBB83f5fBE32A6666A` |
| **FreelancerEscrow** | `0x1a112d7D350976A7b5015868F4DF3bdC8A46570d` |
| **DigitalRWA** | `0xb0a742a2302B043718b60053b135dC432C892852` |
| **FeeDistributor** | `0x4710d00AC3C2B6d0375F762076BDCE5ef835E64f` |
| **GovernanceToken (tGOV)** | `0x612B5dda1BCBe17Dff554bb446A8018a574DBe37` |
| **UserProfile** | `0x432aCe196DFD335396257e0CDF33B3f815b6fF0B` |
| **MockUSDC** | `0xBF4588E207c2191Ee9D3f114370a6dbf4BACFFf3` |

All verified on [Basescan Sepolia](https://sepolia.basescan.org). RWA pricing: Chainlink testnet feeds are deprecated (see [Shutdown Policy](https://docs.chain.link/data-feeds/selecting-data-feeds#data-feed-shutdown-policy)); price set via admin `setManualPrice()` ($3000 ETH/USD), `syncPrice()` remains primary if a live feed returns.

### Arbitrum Sepolia Deployments (post-fix, all verified)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0xAe743AC8eBE1fe05114bB82F68b51A9a2BabD9Df` |
| **FreelancerEscrow** | `0x88fB6Ae65B2c6011F4dE243BbDa100dC57Cd5FE5` |
| **DigitalRWA** | `0x81C11612df53Bf2564CFDEc7C7E11407db6E10Ce` |
| **FeeDistributor** | `0x0790bB1Ee4ee086C2610346E2290B38BC75Ac347` |
| **GovernanceToken (tGOV)** | `0x0061E989c93c38aAd363a86e1AD66875A93226d7` |
| **UserProfile** | `0x090AAe945842f7bf73533776B226B2979293f709` |
| **MockUSDC** | `0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B` |

All verified on [Arbiscan Sepolia](https://sepolia.arbiscan.io). RWA pricing: manual `setManualPrice()` fallback ($3000 ETH/USD) — no classic Chainlink feeds remain on this testnet.

### Polygon Amoy Deployments (post-fix, all verified)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0x756CF434FAB30A18117810B9dC3a8f7F68e891DB` |
| **FreelancerEscrow** | `0xb02cca2D8Fd71bE960f6C261EAD2f460dF8b0cBb` |
| **DigitalRWA** | `0xBCe3E78Cac1Dd60857880Eb833700ec09FcF2483` |
| **FeeDistributor** | `0x18F01543d6D1AF6f80E8624f17bc73666e43525e` |
| **GovernanceToken (tGOV)** | `0xFd919cE133d356bdeb0577e6b35b20b7caD69722` |
| **UserProfile** | `0x6eFe1E8E77B7Fd4d55a61E7de2d6dd4799FC47d0` |
| **MockUSDC** | `0x7b15CF801566053B6aDee1a497A8981C190b241B` |

All verified on [Polygonscan Amoy](https://amoy.polygonscan.com). RWA pricing: manual `setManualPrice()` fallback ($0.20 POL/USD) — POL/USD feed sunset; only ETH/USD remains (wrong asset for native deposits).

## Features

- **Marketplace**: fixed & Dutch listings with description, tags, and NFT flag; native (ETH/POL), USDC, and USDT payments via an owner-set token allowlist.
- **Freelance**: gigs and projects with GitHub / portfolio / category / min-budget / duration metadata; milestone escrow with yield.
- **RWA**: tokenized real-world assets with full metadata (token type, jurisdiction, issuer, risk level); holder whitelist via USDC/USDT balance (multi-token whitelist).
- **Profiles**: user profiles with optional social fields (GitHub, website, location, skills, Twitter, Telegram) plus reviews.
- **Faucet**: mint test tokens with configurable per-token amounts.

## Tech Stack

- **Smart Contracts**: Hardhat (Solidity 0.8.37, EVM cancun, viaIR)
- **Frontend**: Next.js + wagmi + Reown AppKit
- **Styling**: Tailwind CSS

## Commands

```bash
# Contracts
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network baseSepolia
npx hardhat run scripts/deploy.js --network arbitrumSepolia

# Frontend
cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Security

All 15 audit findings fixed and regression-tested. See `AUDIT-REPORT.md` and `SECURITY.md`.

- `nonReentrant` on all external functions that make external calls
- Custom errors, zero-address guards, AccessControl roles
- Oracle: dynamic decimals + staleness + 20% max-deviation
- Whitelist with 24h expiry flags (DigitalRWA)
- 13 Foundry + 137 Hardhat tests passing

## Deploy

Cloudflare Pages — auto-deploys on push to main. Build command: `npm run build`, publish dir: `out/`.

## 📬 Contact

- **Website**: [https://trestle.website](https://trestle.website)
- **Testnet Hub**: [Testnet Hub](https://testnet.trestle.website)
- **Reward Hub**: [Reward Hub](https://reward.trestle.website)
- **GitHub**: [Trestle DeFi](https://github.com/Trestle-DeFi)
- **Documentation**: [https://docs.trestle.website](https://docs.trestle.website)
- **X (Twitter)**: [Trestle DeFi](https://x.com/Trestle_0xArch)
- **BlueSky**: [Trestle DeFi](https://bsky.app/profile/trestle-0xarch.bsky.social)
- **Medium**: [Trestle DeFi](https://medium.com/@trestle_defi)
- **Discord**: [Trestle DeFi](https://discord.gg/4dCCvnJYGT)
- **Telegram**: [trestleDeFi](https://t.me/trestleDeFi)
- **Telegram App**: [trestlehub_bot](https://t.me/trestlehub_bot)
- **Email**: contact@trestle.website