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

### Base Sepolia Deployments (latest — 2026-11-04, full redeploy with migration/wiring fixes)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0x975C9fFA819f6057d9515CC17c93bcE52BCA8BED` |
| **FreelancerEscrow** | `0x50a354b985b6c68C8f2288a28354b9885E01C4F5` |
| **DigitalRWA** | `0x1D1dA38eb1F28b6728ef7538d2A2de4D5a299f83` |
| **FeeDistributor** | `0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6` |
| **GovernanceToken (tGOV)** | `0x0bd00b1134bad04117e14c36D1055Ce6c1d8570D` |
| **UserProfile** | `0x0bd00b1134bad04117e14c36D1055Ce6c1d8570D` |
| **MockUSDC** | `0xB836A5627E3c1dd9b7602259E28AA433bfb8c1cC` |

All verified on [Basescan Sepolia](https://sepolia.basescan.org), including the 2026-10-21 bug-batch re-redeploy (DigitalGoods: TRST-03 fee-on-transfer refund → JKO-4 dispute-deadline refresh → ARFAN-1 zero-reserve/zero-price guards incl. compiled-in DutchAuctionLib; FreelancerEscrow: TRST-01/02/04/05/06 + ARFAN-2 milestone-scaling invariant; 22-test Foundry suite) and the 2026-10-25 BANI-FOT re-redeploy (`fundProjectWithToken` now measures received tokens, reverts with `InsufficientReceived` below the budget, and refunds only the net surplus — closes the fee-on-transfer insolvency/deadlock). RWA pricing: Chainlink testnet feeds are deprecated (see [Shutdown Policy](https://docs.chain.link/data-feeds/selecting-data-feeds#data-feed-shutdown-policy)); price set via admin `setManualPrice()` ($3000 ETH/USD), `syncPrice()` remains primary if a live feed returns.

### Arbitrum Sepolia Deployments (latest — 2026-11-04, full redeploy with migration/wiring fixes)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0xD0535723f2E33A8d6d05FDA33Ea85cDbCaea8EF5` |
| **FreelancerEscrow** | `0x7D31806d5AD7deB103bf42156bBfd371dA409192` |
| **DigitalRWA** | `0x013Af09898e4B946e79553bCDaf875872bc73A6d` |
| **FeeDistributor** | `0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6` |
| **GovernanceToken (tGOV)** | `0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6` |
| **UserProfile** | `0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6` |
| **MockUSDC** | `0x907EAd771eB0fB1BCC708c1E49B5881d5AC26C25` |
| **MockUSDT** | `0xa85E2c21d403F6AADe6767dDDEa1056BA9942cD1` |

All verified on [Arbiscan Sepolia](https://sepolia.arbiscan.io), including the 2026-10-21 bug-batch re-redeploy (same fix set as Base Sepolia) and the 2026-10-25 BANI-FOT re-redeploy. RWA pricing: manual `setManualPrice()` fallback ($3000 ETH/USD) — no classic Chainlink feeds remain on this testnet.

### Polygon Amoy Deployments (2026-11-04, full redeploy with migration/wiring fixes)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0x904B176AbDb890efCE94A900ec58ac6ba5542ddE` |
| **FreelancerEscrow** | `0x797C5F47C08779bacA98F6f98E9148b4bb0c1FCb` |
| **DigitalRWA** | `0x3Ca20bF33BCaab77102E5DA6819c682a73a7cc5b` |
| **FeeDistributor** | `0x4104eA3D55F9C2F5818671e5365F801996D83038` |
| **GovernanceToken (tGOV)** | `0x7f411bA9824513a95C591A061F97A0A375B2cB71` |
| **UserProfile** | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` |
| **MockUSDC** | `0xBD551EE22321B500AB171885eb77574943aB65E1` |

All verified on [Polygonscan Amoy](https://amoy.polygonscan.com), including the 2026-10-21 bug-batch re-redeploy (same fix set as Base Sepolia) and the 2026-10-25 BANI-FOT re-redeploy. RWA pricing: manual `setManualPrice()` fallback ($0.20 POL/USD) — Amoy ETH/USD feed is sunset (contract exists but reverts on all calls).

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
npx hardhat run scripts/deploy_all.js --network baseSepolia
npx hardhat run scripts/deploy_all.js --network arbitrumSepolia

# Frontend
cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Security

All 15 audit findings fixed and regression-tested. See `SECURITY.md`.

- `nonReentrant` on all external functions that make external calls
- Custom errors, zero-address guards, AccessControl roles
- Oracle: dynamic decimals + staleness + 20% max-deviation
- Whitelist with 24h expiry flags (DigitalRWA)
- 144 Hardhat tests passing

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