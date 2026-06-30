# testnet.trestle.website

Testnet platform for Trestle DeFi. Smart contracts deployed on Polygon Amoy, with a Next.js frontend.

## Smart Contracts (Amoy)

| Contract | Purpose | Address |
|----------|---------|---------|
| **DigitalGoods** | Fixed-price & Dutch auction listings | See `.env` `NEXT_PUBLIC_DIGITAL_GOODS` |
| **FreelancerEscrow** | Milestone-based gigs & projects | See `.env` `NEXT_PUBLIC_FREELANCER_ESCROW` |
| **DigitalRWA** | Tokenized real-world assets (whitelist-gated) | See `.env` `NEXT_PUBLIC_DIGITAL_RWA` |
| **FeeDistributor** | Fee splitting (yield vault / treasury / buyback) | See `.env` `NEXT_PUBLIC_FEE_DISTRIBUTOR` |
| **GovernanceToken** | Mock governance token | See `.env` `NEXT_PUBLIC_GOV_TOKEN` |
| **MockUSDC / MockUSDT** | Test stablecoins (18 decimals) | See `.env` `NEXT_PUBLIC_MOCK_USDC` / `NEXT_PUBLIC_MOCK_USDT` |
| **UserProfile** | On-chain profiles & reviews | See `.env` `NEXT_PUBLIC_USER_PROFILE` |

## Tech Stack

- **Smart Contracts**: Hardhat (Solidity 0.8.28)
- **Frontend**: Next.js + wagmi + Reown AppKit
- **Styling**: Tailwind CSS

## Commands

```bash
# Contracts
cd testnet-trestle-website/contracts
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network amoy

# Frontend
cd testnet-trestle-website/frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Deploy

Cloudflare Pages — auto-deploys on push to main. Build command: `npm run build`, publish dir: `out/`.

## Contact

- **Website**: [https://trestle.website](https://trestle.website)
- **GitHub**: [Trestle DeFi](https://github.com/Trestle-DeFi)
- **Discord**: [Trestle DeFi](https://discord.gg/4dCCvnJYGT)
- **Telegram**: [trestleDeFi](https://t.me/trestleDeFi)
- **Telegram App**: [trestlehub_bot](https://t.me/trestlehub_bot)
- **Email**: contact@trestle.website
