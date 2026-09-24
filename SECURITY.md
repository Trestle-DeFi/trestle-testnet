# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately via **contact@trestle.website**. Do not open public GitHub issues for security bugs.

## Bug Bounty

We run a bug bounty program with tiered rewards. All hNOBT rewards are 10x the base rate.

**To claim rewards:** Join [reward.trestle.website](https://reward.trestle.website), submit your vulnerability report, and complete verification.

### Submission Format

1. **Vulnerability Title**
2. **Steps to Reproduce**
3. **Proof of Concept** (Amoy, Arbitrum Sepolia, or Base Sepolia Testnet tx hash or code)

### Response Timeline

- Acknowledgement: 48 hours
- Triage: 7 days
- Reward: 14 days after validation

### Reward Tiers

| Severity | Target Systems & Scope | hNOBT Reward | xGov Reward | Payout Release |
|----------|------------------------|--------------|-------------|----------------|
| **Critical (S1)** | Escrow protocol bypassing vectors. Dutch Auction pricing or clearing logic exploits. Wallet-draining smart contract flaws. | 100,000 hNOBT | 2,500 xGov | **Instant Release** (Within 48 hours of patch) |
| **High (S2)** | Deadlocked contract states. Transaction verification loop failures. Telegram Mini-App backend API manipulation. | 50,000 hNOBT | 1,000 xGov | **7-Day Security Hold** |
| **Medium (S3)** | RPC node desynchronization errors. App state integration dropping inside Telegram. Incorrect event emission configurations. | 20,000 hNOBT | 250 xGov | **14-Day Processing Cycle** |
| **Low (S4)** | Text typos in documentation. Layout shifting/cropping inside webviews. UI styling/cosmetic discrepancies. | 2,500 hNOBT | 0 xGov | **End of Testnet Phase** |

### Sybil-Defense Rules

1. **Proof-of-Concept Requirement:** No S1, S2, or S3 bug bounty points will be logged without an accompanying active **Polygon Amoy, Arbitrum Sepolia, or Base Sepolia Testnet Transaction Hash** or a valid, reproducible local code fork.

2. **Retention Rule:** Growth referrals are only counted if the incoming users pass Trestle Telegram/Discord captcha gate and stay active for at least 72 hours.

3. **Multi-Account Rule:** If two different profiles submit identical bugs or referral lists, the payout is split 50/50 or canceled entirely pending identity verification.

### Payout Options

Join [reward.trestle.website](https://reward.trestle.website) to validate and claim rewards. Two options:

| Option | Requirements | Bug Bounty Payout |
|--------|-------------|-------------------|
| **A: Full Reward** | Stage 1 (Gitcoin Passport + Accounts) + Stage 2 (Biometric) | **100% hNOBT + 100% xGov** |
| **B: Early Withdrawal** | Stage 1 (Gitcoin Passport + Accounts) only | **50% hNOBT + 0 xGov** |

## Scope

**In-scope:**
- Smart contracts (Solidity **0.8.37**, EVM cancun, viaIR) — FreelancerEscrow, DigitalGoods, DigitalRWA, FeeDistributor, UserProfile, MockGovernanceToken, MockERC20 (MockUSDC), MockV3Aggregator
- Frontend (Next.js + wagmi) — useContracts, web3 config, Marketplace/Freelance/RWA views
- Deploy scripts (Hardhat)

**Out-of-scope:**
- UI/UX, missing features, third-party integrations, social engineering, private/internal code

## Contract Addresses (Base Sepolia Testnet — redeployed 2026-09-24, all verified)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0x89f5394a468343F405285040664Fd77843D2a2e6` |
| FreelancerEscrow | `0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B` |
| DigitalRWA | `0x5582496273a71E60e457D19773050CC848A2F52C` |
| FeeDistributor | `0xcc5f9C02cD093002cE3921180e32f76cE03F01C0` |
| GovernanceToken (tGOV) | `0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914` |
| UserProfile | `0xa1889d658601c7fA649a70516341fF4aac761ca8` |
| Mock USDC | `0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E` |

## Contract Addresses (Arbitrum Sepolia Testnet — redeployed 2026-09-24, all verified)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0x6D6C679279f5C680e5a6ef33306F2e9A78577DCa` |
| FreelancerEscrow | `0x58E3B6f2eFD7F3ee4afe98A754e155DBE9052513` |
| DigitalRWA | `0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D` |
| FeeDistributor | `0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71` |
| GovernanceToken (tGOV) | `0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D` |
| UserProfile | `0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D` |
| Mock USDC | `0xC36C239D0b3144015178727f939e0766Bf71D816` |

## Contract Addresses (Polygon Amoy Testnet — redeployed 2026-09-25, all verified)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0xBd124c4395b47093CEc78497ec8b098977416396` |
| FreelancerEscrow | `0x7007DC17282316676c5d1Eb085D3CeC993f92193` |
| DigitalRWA | `0x7f750E8BD9c9C2685710A03De5307961BC50aF31` |
| FeeDistributor | `0x4104eA3D55F9C2F5818671e5365F801996D83038` |
| GovernanceToken (tGOV) | `0x7f411bA9824513a95C591A061F97A0A375B2cB71` |
| UserProfile | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` |
| Mock USDC | `0xBD551EE22321B500AB171885eb77574943aB65E1` |

## Audit Findings — All Fixed (2026-09-18)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| E-1 | Critical | Shared vault drain via `fundProjectWithToken` refund | Fixed |
| E-2 | Critical | Vault migration stranding | Fixed |
| E-3 | High | Dispute fee not split | Fixed |
| H-1 | High | ERC-4626 inflation attack | Fixed |
| A-1 | High | Stale oracle — hardcoded `/1e8` | Fixed |
| A-2 | High | Dust milestone bricking | Fixed |
| A-5 | Medium | Redundant whitelist loop | Fixed (24h expiry flags) |
| A-6 | Low | MockGovernanceToken burn no access control | Acknowledged (mock only) |
| A-7 | Low | `setFeeDistributor` missing zero-check | Fixed |

**Tests:** 15 Foundry + 144 Hardhat passing. Slither: 0 HIGH/MEDIUM findings.

## Testnet Review Findings — 2026-09-24 (F-1 … F-9)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| F-1 | High | Deploy scripts called 1-arg UserProfile constructor; no hook wiring | Fixed |
| F-2 | Medium | Rejected-milestone dead-end locked escrow (no resubmit path) | Fixed |
| F-3 | Medium | `FeeDistributor.setSplitBps` forced buyback share to 0 | Fixed |
| F-4 | Medium | `hireGig` copied milestone deadlines without re-validation | Fixed |
| F-5 | Low-Med | `uint8` review counters wrapped at 256 | Fixed (`uint32`) |
| F-6 | Low | `resolveDispute` didn't decrement review counters | Fixed |
| F-7 | Low | Faucet rendered zero-address USDT mint tile | Fixed |
| F-8 | Low | Attester key centralizes 75% of composite score | Acknowledged (ops: monitor / multisig) |
| F-9 | Info | Unbounded review-score loops (view-only today) | Noted (cap later) |

## Security Properties

- `nonReentrant` on all external functions that make external calls
- Custom errors for gas-efficient reverts
- Zero-address validation in constructors and admin setters
- Access control via `Ownable` + `AccessControl` roles
- Pausable on DigitalRWA (freeze creation/funding only; withdrawals always open)
- Token-gated whitelist on DigitalRWA with 24h expiry flags
- Oracle: dynamic feed decimals, staleness checks, and 20% max-deviation guard

Always verify addresses on [Basescan Sepolia](https://sepolia.basescan.org), [Arbiscan Sepolia](https://sepolia.arbiscan.io), or [Polygonscan Amoy](https://amoy.polygonscan.com) before interacting.
