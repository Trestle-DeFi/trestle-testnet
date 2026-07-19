# Telegram Mini-App Frontend

React/Vite Telegram Mini-App for Trestle DeFi. Wallet via Reown AppKit + wagmi. Testnet contracts on Amoy + Virtual Vault for off-chain staking.

## Pages

- **Dashboard** — Vault balance overview, quick links
- **Stake** — Lock virtual hNOBT, earn BTR yield
- **Tasks** — Earn hNOBT points by completing tasks
- **Verify** — Stage 1 (Gitcoin Passport) + Stage 2 (biometric)
- **Marketplace** — Testnet digital goods stub
- **Withdraw** — Yield refresh + on-chain settlement voucher
- **Astra AI** — AI chat assistant (floating widget)

## Setup

```bash
cp .env.example .env   # fill in VITE_WALLETCONNECT_PROJECT_ID
npm install
npm run dev             # http://localhost:5173
npm run build
```

## Required Env

| Variable | Description |
|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | Reown Cloud project ID |
| `VITE_API_URL` | Reward worker API (`https://reward-api.trestle.website`) |
| `VITE_VAULT_API_URL` | Vault worker API (`https://vault.trestle.website`) |

---

**Disclaimer:** Not affiliated with Trestle Protocol (Celestia Bridge).

## 📬 Contact

- **Website**: [https://trestle.website](https://trestle.website)
- **Testnet Hub**: [Testnet Hub](https://testnet.trestle.website)
- **Reward Hub**: [Reward Hub](https://reward.trestle.website)
- **GitHub**: [Trestle DeFi](https://github.com/Trestle-DeFi)
- **Documentation**: [https://docs.trestle.website](https://docs.trestle.website)
- **X (Twitter)**: [Trestle DeFi](https://x.com/Trestle_0xArch)
- **Medium**: [Trestle DeFi](https://medium.com/@trestle_defi)
- **Discord**: [Trestle DeFi](https://discord.gg/4dCCvnJYGT)
- **Telegram**: [trestleDeFi](https://t.me/trestleDeFi)
- **Telegram App**: [trestlehub_bot](https://t.me/trestlehub_bot)
- **Email**: contact@trestle.website

