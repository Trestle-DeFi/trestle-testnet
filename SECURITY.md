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

## Contract Addresses (Base Sepolia Testnet — DigitalGoods + FreelancerEscrow re-redeployed 2026-10-21: bug-batch TRST-01..06 + JKO-4 + ARFAN-1/ARFAN-2 fixes)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` |
| FreelancerEscrow | `0xBD551EE22321B500AB171885eb77574943aB65E1` |
| DigitalRWA | `0x5582496273a71E60e457D19773050CC848A2F52C` |
| FeeDistributor | `0xcc5f9C02cD093002cE3921180e32f76cE03F01C0` |
| GovernanceToken (tGOV) | `0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914` |
| UserProfile | `0xa1889d658601c7fA649a70516341fF4aac761ca8` |
| Mock USDC | `0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E` |

## Contract Addresses (Arbitrum Sepolia Testnet — DigitalGoods + FreelancerEscrow re-redeployed 2026-10-21: bug-batch TRST-01..06 + JKO-4 + ARFAN-1/ARFAN-2 fixes)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0xa9E7f0762EEC2902cC44577D8F799743A62171c8` |
| FreelancerEscrow | `0xBeb83e3d78772c3DC32142c590eac8cB39A0aaCA` |
| DigitalRWA | `0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D` |
| FeeDistributor | `0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71` |
| GovernanceToken (tGOV) | `0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D` |
| UserProfile | `0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D` |
| Mock USDC | `0xC36C239D0b3144015178727f939e0766Bf71D816` |

## Contract Addresses (Polygon Amoy Testnet — DigitalGoods + FreelancerEscrow re-redeployed 2026-10-21: bug-batch TRST-01..06 + JKO-4 + ARFAN-1/ARFAN-2 fixes)

| Contract | Address |
|----------|---------|
| DigitalGoods | `0x8c99Df55d6fb332eb0B88DE0ba580b9EC3dB28Fb` |
| FreelancerEscrow | `0xc710f53C77698172D43b02cEa72d18B920dE5F9c` |
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

**Tests:** 144 Hardhat passing. Slither: 0 HIGH/MEDIUM findings.

## Bug Bounty Findings — 2026-10 (ZAFRAN-H1)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| ZAFRAN-H1 | High (S2) | `autoResolveDispute` majority-vote heuristic let freelancer steal remainder via strategic dispute | Fixed 2026-10-09 (remainder defaults to full client refund; redeployed all 3 testnets) |

## Bug Bounty Findings — 2026-10 (F-T1 coarse-share)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| F-T1 (Ibnu) | High (S2) | Vault donation could mint a coarse-but-nonzero share count; redeeming it booked surplus as yield and bricked all remaining milestones (bypasses H-1 `==0` + A-2 dust bump) | Fixed 2026-10-12 (`MIN_SHARE_RATE` deposit guard + bumped-redemption surplus held in escrow, not treasury; redeployed all 3 testnets) |

Fix: `FreelancerEscrow._depositToVault` reverts `CoarseShares()` unless `sharesAdded * 1e18 >= assets * MIN_SHARE_RATE` (1e15 = shares ≥ assets/1000); `_withdrawFromVault` no longer books surplus from an A-2 bumped redemption as `yieldOut`. New FE: Base Sepolia `0x2Da8486d0bC8E44E23eF02a3760745FC0b57B5E2`, Arbitrum Sepolia `0x18F01543d6D1AF6f80E8624f17bc73666e43525e`, Polygon Amoy `0x33226359935b5922F834355ced7D49A66825f92C` — all source-verified on the explorers (Etherscan API V2, 2026-10-12) and bytecode/wiring-confirmed by `scripts/verify_live_ft1.js`.

## Bug Bounty Findings — 2026-10 (gig milestone deadline bound)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| GIG-DEADLINE (Nordin/KupiaSec) | Medium (S3) | `createGig`/`updateGig` have no duration field and pass `_durationDays == 0` to `_validateMilestones`, so the relative deadline cap never fired — a freelancer could commit milestones with deadlines years in the future (zombie escrow), bloating vault share obligations and blocking vault migration | Fixed 2026-10-15 (always-on `MAX_MILESTONE_HORIZON` = 365 days cap when no duration is supplied; redeployed all 3 testnets 2026-10-16) |

Fix: `_validateMilestones` now computes `maxDeadline = _durationDays > 0 ? _durationDays * 1 days : MAX_MILESTONE_HORIZON` and unconditionally enforces `_milestoneDeadlines[i] <= block.timestamp + maxDeadline`, so gig paths (which pass 0) are bounded to 365 days. New FE: Base Sepolia `0x756CF434FAB30A18117810B9dC3a8f7F68e891DB`, Arbitrum Sepolia `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952`, Polygon Amoy `0xD0de38492b5f5F2D3979DdD798CCE95395140C53` — all source-verified on the explorers (Etherscan API V2, 2026-10-16) and bytecode/wiring-confirmed by `scripts/verify_live_gig.js`.

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
