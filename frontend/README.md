# Telegram Mini-App Frontend

React/Vite Telegram Mini-App for Trestle DeFi. Wallet connection via Reown AppKit + wagmi. Telegram TWA via @telegram-apps/sdk.

## Pages

- **Dashboard** — User overview
- **Marketplace** — Buy/sell digital goods
- **Tier1 Staking** — Stake Tier 1 pool
- **Tier2 Staking** — Stake Tier 2 pool
- **Tier3 Staking** — Stake Tier 3 pool (vault)
- **Withdraw** — Withdraw interface
- **Astra AI** — AI chat assistant

## Setup

```bash
cp .env.example .env   # fill in VITE_WALLETCONNECT_PROJECT_ID, etc.
npm install
npm run dev             # http://localhost:5173
npm run build
```

## Required Env

| Variable | Description |
|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | Reown Cloud project ID |
| `VITE_API_URL` | Reward worker API |
| `VITE_VAULT_API_URL` | Vault worker API |

---

**Disclaimer:** Not affiliated with Trestle Protocol (Celestia Bridge).
