# Trestle Bug Bounty — Public Program Page

> **Submit to:** `contact@trestle.website` · **Patch-hour response** · **Payouts on Polygon** (hNOBT) with xGov governance credits via the Reward Hub

---

## 1. Scope

### Smart contracts (`Trestle-DeFi/trestle-testnet`, Solidity 0.8.37, cancun, viaIR)

| Contract | Base Sepolia | Arbitrum Sepolia | Polygon Amoy |
|----------|--------------|------------------|--------------|
| FreelancerEscrow | `0x8FBa99052f1424d205D28b44239F5B376aBd9Be6` | `0x33226359935b5922F834355ced7D49A66825f92C` | `0xd1Fdb92B75DD465eB0808b73BFf6389813aB3b65` |
| DigitalGoods | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` | `0xa9E7f0762EEC2902cC44577D8F799743A62171c8` | `0x8c99Df55d6fb332eb0B88DE0ba580b9EC3dB28Fb` |
| DigitalRWA, FeeDistributor, UserProfile, mock tokens | see [`SECURITY.md`](./SECURITY.md) | — | — |

`DutchAuctionLib` is an internal library compiled into both consumer contracts — report bugs against the consumers.

### Reward ecosystem (Cloudflare Workers)
- Reward Hub API / vault (`reward.trestle.website`)
- TMA vault module, moderation worker, faucet

### Out of scope
UI/UX, missing features, third-party integrations, social engineering, spam/DoS, attacks on other hunters or validators, agreements with validators to block users from claiming, private/internal code, testnet token drain designed to grief other users.

### Testnet lending policy
Testnet tokens/tGE are sufficiently available; do not attack the faucet or other users to fund exploits.

---

## 2. Severity → Reward tiers

| Tier | Class | Reward (Full, Option A) | Early (Option B: 50% hNOBT, no xGov) |
|------|-------|-------------------------|--------------------------------------|
| S1 | Critical | 100,000 hNOBT + 2,500 xGov | 50,000 hNOBT |
| S2 | High (incl. deadlocked contract states) | 50,000 hNOBT + 1,000 xGov | 25,000 hNOBT |
| S3 | Medium | 20,000 hNOBT + 250 xGov | 10,000 hNOBT |
| S4 | Low | 2,500 hNOBT | 1,250 hNOBT |

- **Option A (full)** unlocks at **Reward Hub Stage 2** (WebAuthn biometric verification); the hNOBT portion is sent after a **7-day security hold**, xGov credited via the Reward Hub.
- **Option B (early)**: Stage 1 participants (Gitcoin Passport > 0 + 2 linked accounts) can take the 50% hNOBT immediately.
- Low-severity findings against contracts are bumped to Medium tier at vendor discretion (realized policy).
- Duplicate/rejected: hall-of-fame mention (valid first-report wins).

---

## 3. Submission rules

1. Email `contact@trestle.website` with: title, affected contract/worker, code refs (file/line), reproduction script, and a clear severity claim with CVSS.
2. PoC requirements: 5× runs, negative control, and no private keys (fork `anvil_impersonateAccount` / local tests).
3. Testnet-only exploits in your own accounts. Never touch other users' funds or records.
4. Do not disclose before the fix ships.

---

## 4. Resolved findings (alias-level ledger)

| Alias | Ref(s) | Finding | Tier | Status |
|-------|--------|---------|------|--------|
| zafran | H1 | `autoResolveDispute` count-heuristic griefing pays unearned escrow | S2 | ✅ Fixed + tested |
| ibnu | FT1 | Coarse-share vault donation permanently bricks milestones | S2 | ✅ Fixed + tested |
| ihavemage | F1/F4/F3/F5 | Reward credit without auth; WebAuthn verification bypass; D1 schema + PII leak via public endpoints; unauth fingerprint flagging | 2× S2 · 2× S3 | ✅ Fixed + tested |
| iblitzc0de | TRST-01..06 | Dispute preemption, arbitration front-run, fee-on-transfer escrow brick, Dutch deadline skip, vault migration lock, reject-loop clock reset | 6× S3 | ✅ Fixed + tested |
| joko | JKO-4 | Zero-second dispute window raid (atomic dispute+resolve) | S1 | ✅ Fixed + tested |
| arfan | ARFAN-1/2 | Zero-reserve Dutch auction terminal state; deep-discount milestone scaling bricks project | 2× S2 | ✅ Fixed + tested |
| bani | BANI-FOT | `FreelancerEscrow.fundProjectWithToken` fee-on-transfer funding leaves escrow insolvent and deadlocks every exit path | S2 | ✅ Fixed + tested (2026-10-25) |

Full technical write-ups are in the repository commit history (fix markers `TRESTLE-*`).

---

## 5. Program transparency (paid tx ledger — no hunter mapping)

All confirmed rewards are paid from the program treasury on Polygon mainnet. Individual hunter↔tx mapping is kept private for hunter privacy; the ledger below is complete and auditable.

| Date | Amount | Explorer |
|------|--------|----------|
| 2026-10 | 50,000 hNOBT | [tx](https://polygonscan.com/tx/0x1cbbdea8ca0f4581cdbf050826eab49960345ab7180fcabf35fb708b45ba1935) |
| 2026-10-21 | 140,000 hNOBT | [tx](https://polygonscan.com/tx/0xb21b14b1885a3f8cbcd6d4097e2e7c3a920f4a1e187c3925082e3adf524b0f50) |
| 2026-10-21 | 120,000 hNOBT | [tx](https://polygonscan.com/tx/0xdf4e27179b0375d513b2ec3ed6c04ab564a0ebd84b9b9ec10757cdd694fdcdb0) |
| 2026-10-21 | 100,000 hNOBT | [tx](https://polygonscan.com/tx/0x09d11e969a2df5a7342fcd276862f3379adf67caa5dd674c560bddb63de47ed1) |
| 2026-10-25 | 100,000 hNOBT | [tx](https://polygonscan.com/tx/0xcba5cb889b13a9d98a66e5b014af90f9d7b31311aab40c2fc3ee3978aae250fa) |

**Program totals (2026-10-25): 510,000 hNOBT paid · 7 confirmed hunters · 13 resolved findings.**

---

## 6. Hall of Fame (2026)

zafran · ibnu · ihavemage · iblitzc0de · joko · arfan · bani

> Program completed this cycle with zero exploit-caused fund loss on live testnets; every confirmed finding was patched with regression coverage before its reward left the treasury. Full program rules: [`bounty.md`](https://github.com/Trestle-DeFi/trestle-docs/blob/main/docs/community/bounty.md).
