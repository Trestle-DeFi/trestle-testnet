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

### Base Sepolia Deployments (latest — 2026-09-24, all verified)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0x89f5394a468343F405285040664Fd77843D2a2e6` |
| **FreelancerEscrow** | `0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B` |
| **DigitalRWA** | `0x5582496273a71E60e457D19773050CC848A2F52C` |
| **FeeDistributor** | `0xcc5f9C02cD093002cE3921180e32f76cE03F01C0` |
| **GovernanceToken (tGOV)** | `0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914` |
| **UserProfile** | `0xa1889d658601c7fA649a70516341fF4aac761ca8` |
| **MockUSDC** | `0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E` |

All verified on [Basescan Sepolia](https://sepolia.basescan.org). RWA pricing: Chainlink testnet feeds are deprecated (see [Shutdown Policy](https://docs.chain.link/data-feeds/selecting-data-feeds#data-feed-shutdown-policy)); price set via admin `setManualPrice()` ($3000 ETH/USD), `syncPrice()` remains primary if a live feed returns.

### Arbitrum Sepolia Deployments (latest — 2026-09-24, all verified)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0x6D6C679279f5C680e5a6ef33306F2e9A78577DCa` |
| **FreelancerEscrow** | `0x58E3B6f2eFD7F3ee4afe98A754e155DBE9052513` |
| **DigitalRWA** | `0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D` |
| **FeeDistributor** | `0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71` |
| **GovernanceToken (tGOV)** | `0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D` |
| **UserProfile** | `0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D` |
| **MockUSDC** | `0xC36C239D0b3144015178727f939e0766Bf71D816` |

All verified on [Arbiscan Sepolia](https://sepolia.arbiscan.io). RWA pricing: manual `setManualPrice()` fallback ($3000 ETH/USD) — no classic Chainlink feeds remain on this testnet.

### Polygon Amoy Deployments (2026-09-25, all verified)

| Contract | Address |
|----------|---------|
| **DigitalGoods** | `0xBd124c4395b47093CEc78497ec8b098977416396` |
| **FreelancerEscrow** | `0x7007DC17282316676c5d1Eb085D3CeC993f92193` |
| **DigitalRWA** | `0x7f750E8BD9c9C2685710A03De5307961BC50aF31` |
| **FeeDistributor** | `0x4104eA3D55F9C2F5818671e5365F801996D83038` |
| **GovernanceToken (tGOV)** | `0x7f411bA9824513a95C591A061F97A0A375B2cB71` |
| **UserProfile** | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` |
| **MockUSDC** | `0xBD551EE22321B500AB171885eb77574943aB65E1` |

All verified on [Polygonscan Amoy](https://amoy.polygonscan.com). RWA pricing: manual `setManualPrice()` fallback ($0.20 POL/USD) — Amoy ETH/USD feed is sunset (contract exists but reverts on all calls).

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