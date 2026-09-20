# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately via **contact@trestle.website**. Do not open public GitHub issues for security bugs.

## Bug Bounty

We run a bug bounty program with tiered rewards. All hNOBT rewards are 10x the base rate.

**To claim rewards:** Join [reward.trestle.website](https://reward.trestle.website), submit your vulnerability report, and complete verification.

### Submission Format

1. **Vulnerability Title**
2. **Steps to Reproduce**
3. **Proof of Concept** (Amoy Testnet tx hash or code)

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

1. **Proof-of-Concept Requirement:** No S1, S2, or S3 bug bounty points will be logged without an accompanying active **Polygon Amoy Testnet Transaction Hash** or a valid, reproducible local code fork.

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

## Contract Addresses (Base Sepolia Testnet — latest, all verified)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0xe5665d1D2F180D27d328acCBB83f5fBE32A6666A` |
| FreelancerEscrow | `0x1a112d7D350976A7b5015868F4DF3bdC8A46570d` |
| DigitalRWA | `0xb0a742a2302B043718b60053b135dC432C892852` |
| FeeDistributor | `0x4710d00AC3C2B6d0375F762076BDCE5ef835E64f` |
| GovernanceToken (tGOV) | `0x612B5dda1BCBe17Dff554bb446A8018a574DBe37` |
| UserProfile | `0x432aCe196DFD335396257e0CDF33B3f815b6fF0B` |
| Mock USDC | `0xBF4588E207c2191Ee9D3f114370a6dbf4BACFFf3` |

## Contract Addresses (Arbitrum Sepolia Testnet — latest, all verified)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0xAe743AC8eBE1fe05114bB82F68b51A9a2BabD9Df` |
| FreelancerEscrow | `0x88fB6Ae65B2c6011F4dE243BbDa100dC57Cd5FE5` |
| DigitalRWA | `0x81C11612df53Bf2564CFDEc7C7E11407db6E10Ce` |
| FeeDistributor | `0x0790bB1Ee4ee086C2610346E2290B38BC75Ac347` |
| GovernanceToken (tGOV) | `0x0061E989c93c38aAd363a86e1AD66875A93226d7` |
| UserProfile | `0x090AAe945842f7bf73533776B226B2979293f709` |
| Mock USDC | `0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B` |

## Contract Addresses (Polygon Amoy Testnet — latest, all verified)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0x756CF434FAB30A18117810B9dC3a8f7F68e891DB` |
| FreelancerEscrow | `0xb02cca2D8Fd71bE960f6C261EAD2f460dF8b0cBb` |
| DigitalRWA | `0xBCe3E78Cac1Dd60857880Eb833700ec09FcF2483` |
| FeeDistributor | `0x18F01543d6D1AF6f80E8624f17bc73666e43525e` |
| GovernanceToken (tGOV) | `0xFd919cE133d356bdeb0577e6b35b20b7caD69722` |
| UserProfile | `0x6eFe1E8E77B7Fd4d55a61E7de2d6dd4799FC47d0` |
| Mock USDC | `0x7b15CF801566053B6aDee1a497A8981C190b241B` |

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

**Tests:** 13 Foundry + 137 Hardhat passing. Slither: 0 HIGH/MEDIUM findings.

## Security Properties

- `nonReentrant` on all external functions that make external calls
- Custom errors for gas-efficient reverts
- Zero-address validation in constructors and admin setters
- Access control via `Ownable` + `AccessControl` roles
- Pausable on DigitalRWA (freeze creation/funding only; withdrawals always open)
- Token-gated whitelist on DigitalRWA with 24h expiry flags
- Oracle: dynamic feed decimals, staleness checks, and 20% max-deviation guard

Always verify addresses on [Basescan Sepolia](https://sepolia.basescan.org), [Arbiscan Sepolia](https://sepolia.arbiscan.io), or [Polygonscan Amoy](https://amoy.polygonscan.com) before interacting.
