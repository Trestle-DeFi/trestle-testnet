# Trestle Testnet — Contract Recommendations & Improvement Plan

**Date:** 2026-09-18
**Author:** Cline (post-audit, post-fix review)
**Scope:** All contracts in `contracts/src/`, deployment scripts, frontend coupling, and process
**Related docs:** `AUDIT-REPORT.md` (original audit + Addenda 1–3)

---

## Current State (as of this document)

- All 15 actionable audit findings are **fixed and regression-tested** (see `AUDIT-REPORT.md` → Addendum 3).
- Hardhat suite: **137 passing** · Foundry suite: **7 passing** (`forge test`).
- The contracts are in reasonable shape for a **testnet**. The gap to production readiness is concentrated in key management, pausability, oracle discipline, and dispute economics — the P1 items below.

---

## P0 — Before the next testnet redeploy (do now)

### 1. Sync the frontend with the new ABIs
`frontend/src/config/contracts.ts` + `web3.ts` were built against the pre-fix ABIs. The fixes changed:
- **Added functions:** `DigitalGoods.resolveDispute(uint256,bool)`, `FreelancerEscrow.projectsWithShares()`
- **New custom errors:** `ZeroShares`, `VaultMigrationBlocked`, `SelfAccept`, `TooManyWhitelistTokens`
- **Fee timing (DigitalGoods):** treasury receives the 3% at seller release, not at purchase. Any UI/indexer deriving revenue from `Purchased` events is now wrong — listen for `DeliveryConfirmed` / `Resolved` instead.
- **Changed event payload:** `FundsWithdrawnFromVault(id, available, yieldOut)` — second arg is the amount actually made payable, which can be < the requested principal on a vault shortfall.

### 2. Redeploy the testnets and run e2e
The Amoy / Arbitrum-Sepolia / Base-Sepolia deployments still run the pre-fix bytecode — including the **live E-1 theft vector**. Redeploy all three and run `scripts/e2e_amoy.js` against the fresh addresses. Note: `e2e_amoy.js` must call `syncPrice()` (or a fresh `setManualPrice`) within an hour of any `subscribe()` — the new staleness check enforces it.

### 3. Correct the README security claims
`contracts/README.md` states *"`nonReentrant` on all external state-changing functions"*. After the fixes this is close but still overstated: the listing/creation functions (`listFixed`, `listDutch`, `createProject*`, `createGig`, `updateGig`, `cancelGig`) don't carry it — harmlessly, since they make no external calls, but the docs should match reality (a reviewer or auditor will check).

---

## P1 — Architecture & security hardening (next iteration)

### 4. Multisig + timelock — the #1 structural concern
`scripts/deploy.js` hardcodes the treasury as a plain **EOA** (`0x64A7…66F6`), and the deployer EOA simultaneously holds:
- `DEFAULT_ADMIN_ROLE` + `DISPUTE_AGENT_ROLE` on `FreelancerEscrow`
- `MINTER_ROLE` + `PAUSER_ROLE` on `DigitalRWA`
- `Ownable` on `DigitalGoods`, `FeeDistributor`, `UserProfile`

One leaked key = total control — including `setManualPrice()`, which can rewrite RWA subscription pricing instantly. Before any real value flows:
- Deploy a **Safe multisig** as treasury and admin.
- Wrap the admin roles in an OZ **`TimelockController`** (a short delay is fine on testnet; it exercises the flow).

### 5. Unify the dispute model (and add a bond)
The codebase now has three dispute mechanisms: owner arbitration in `DigitalGoods` (E-3 fix), `DISPUTE_AGENT_ROLE` in `FreelancerEscrow`, and the `approvedCount * 2 > milestones.length` heuristic in `autoResolveDispute`. Extract a single, consistent arbitration pattern. More importantly, add a **dispute bond**: a small deposit by the disputer, forfeited if the ruling goes against them. Without a bond, the DigitalGoods 7-day full-refund default remains economically free for buyers — sellers still eat the free-riding risk even after the E-3 arbitration path was added.

### 6. Add `Pausable` to `FreelancerEscrow` and `DigitalGoods`
`DigitalRWA` has pause/unpause; the two contracts that actually move user money do not. Add OZ `Pausable` with a multisig-held `PAUSER_ROLE` that can freeze new listings / funding / approvals during an incident (redemptions of already-owed funds can stay open, so users are never trapped).

### 7. Oracle hygiene in `DigitalRWA`
- Read `priceFeed.decimals()` dynamically instead of the hardcoded `/ 1e8` in `subscribe()` — the assumption silently breaks on feeds with different precision.
- Add a **max-deviation limit** per `syncPrice()` (e.g., reject moves > 20%) to blunt a compromised/manipulated feed.
- Consider **Chainlink Automation** (or any keeper) to call `syncPrice()` so freshness doesn't depend on someone remembering to call it — the new staleness check in `subscribe()` reverts otherwise, which is safe but a UX cliff.

### 8. Dead fields that promise things they don't do
`assetInfo.lockupDuration`, `redemptionDate`, and `redemptionPrice` are stored in `DigitalRWA` but **enforced nowhere** — transfers work from day one regardless of a marketed "90-day lockup". For an RWA token this is a compliance and credibility problem. Either:
- Implement per-holder acquisition timestamps in `_update()` and block transfers before `lockupDuration` elapses, plus a `redeem()` flow honoring `redemptionDate`/`redemptionPrice`; **or**
- Remove the fields and keep the on-chain representation honest.

### 9. Rework the whitelist from per-transfer loops to per-address flags
Even capped at 10 tokens (M-1 fix), `isWhitelisted()` still performs up to 10 external `balanceOf()` calls inside `_update()` — i.e., on **every transfer**, twice (from + to). Flip the model: an off-chain bot/indexer evaluates eligibility and sets a boolean `whitelisted[user]` flag via an authorized role. Transfers then cost two SLOADs instead of ten CALLs, and the gas-DoS class disappears entirely.

---

## P2 — Economics / product decisions

### 10. Vault design (root cause of E-1/E-2/A-2)
The single shared `yieldVault` with per-project share bookkeeping is what made the theft and the bricking possible. If yield stays a feature, prefer one of:
- **Withdraw-to-escrow pattern:** pull the principal back from the vault when a milestone is *submitted*, hold it in the contract, and pay from there at approval — payouts then never depend on vault state at the critical moment; or
- **Per-(project, vault) share tracking** if multi-vault migration is ever needed.

Also consider a forge **invariant test**: `contract token balance ≥ Σ escrowedAmount` at all times. The class of bug E-1 belonged to is exactly what invariant tests catch.

### 11. Decide deliberately on "refundable digital goods"
Today a DigitalGoods purchase is fully refundable for 7 days, with buyer-favorable default arbitration. That's a legitimate product choice — but make it consciously (document it in the README for sellers), and pair it with the dispute bond from item 5 so the choice can't be exploited cost-free.

### 12. `UserProfile` review spam
One token (1e18) lets an account post unlimited reviews across all users; the cooldown is only per `(reviewer, user)` pair. Cheap options: a global per-reviewer cooldown, or bonded reviews (deposit returned after N days unless successfully disputed).

### 13. `Project.durationDays` is stored but unused
Either use it (e.g., validate milestone deadlines fit within the project duration) or remove it. Keeping unused fields in a money contract invites the "dead field promises" problem from item 8.

---

## P3 — Process / developer experience

### 14. CI with both runners + static analysis
Add a GitHub Actions workflow running on every PR:
- `forge test` (includes the 7 audit regression tests)
- `npx hardhat test` (the 137-test suite)
- `slither .` (static analysis)

The E-1 theft would have been caught by an invariant test long before an audit — invariants are the highest-leverage test investment available here.

### 15. Role separation (M-4) is a deploy-script change
The AccessControl wiring already supports it: after deploying with a multisig, have the admin `grantRole(DISPUTE_AGENT_ROLE, arbiterSafe)` and `revokeRole(DISPUTE_AGENT_ROLE, deployerEOA)`. Fold this into the deploy scripts' post-deploy config so it can't be forgotten.

### 16. Mainnet readiness checklist
- [ ] External audit (Trail of Bits / OpenZeppelin / Spearbit) on the post-fix code
- [ ] Bug bounty program live before mainnet
- [ ] Multisig + timelock for all admin roles (item 4)
- [ ] Pausable wired on both marketplaces (item 6)
- [ ] Lockup/redemption either enforced or removed (item 8)
- [ ] Phased rollout with deposit caps
- [ ] On-chain monitoring/alerting (treasury balance drift, vault share accounting)
- [ ] No mocks (`MockERC20`, `MockGovernanceToken`, `MockYieldVault`) gating any production path

---

## Bottom line

The contracts went from "one live theft vector + two brickable payout paths" to "fixed and regression-tested" in this cycle — that part is done. What separates this codebase from mainnet-ready is not more bug-hunting but **infrastructure discipline**: multisig/timelock (item 4), pausability (item 6), oracle hardening (item 7), and honest enforcement of what the token metadata claims (item 8). Those are far cheaper to add now, while the testnet holds no real value, than after.

*Prepared by Cline on 2026-09-18.*

---

## Cline's Reply — Concrete Response & Execution Plan

My position on each item, with effort estimates and what I can execute immediately in this repo.

### Item-by-item reply

| # | Item | My reply | Effort |
|---|------|----------|--------|
| 1 | Frontend ABI sync | I can do this now — inspect how `contracts.ts`/`web3.ts` load ABIs (handwritten vs artifact imports) and update them for `resolveDispute`, `projectsWithShares`, new errors, and the fee-timing change. | S |
| 2 | Redeploy testnets | I can't run live deploys (needs a funded deployer key + RPC). I **can** prepare everything: fix `e2e_amoy.js` to `syncPrice()` before `subscribe()`, and dry-run the whole deploy + e2e locally on the Hardhat network so the real run is copy-paste. | S prep · live run needs keys |
| 3 | README claims | I'll fix the security table wording immediately. | S |
| 4 | Multisig + timelock | I can wire `TimelockController` + Safe into the deploy scripts with configurable addresses (defaulting to the current EOAs so testnet keeps working). Creating the actual Safe needs your keys/wallets. | M · real setup needs you |
| 5 | Unified arbitration + bond | I'd implement the bond: escrow a `disputeBond` on `dispute()`, return on winning ruling, forfeit on losing. **Needs your sign-off on bond size** — it changes `dispute()` economics. Unifying the three arbitration paths is a follow-up refactor. | M |
| 6 | Pausable | Straightforward: `Pausable` inheritance on both marketplaces, `whenNotPaused` on buy/list/fund/approve, `pause()/unpause()` behind a `PAUSER_ROLE`. Redeploy required. | S–M |
| 7 | Oracle hygiene | Two contained changes: read `priceFeed.decimals()` in `subscribe()` (store once), and add a `MAX_PRICE_DEVIATION` check against the last synced price in `syncPrice()`. | S–M |
| 8 | Lockup enforcement | Real work: per-holder `firstAcquiredAt` mapping + `_update()` gate + migration handling for existing holders. I'd do it as a dedicated release; alternatively remove the fields (also an ABI change). Your call: **enforce or remove?** | M–L |
| 9 | Whitelist flags | Additive design: `whitelisted[user]` flag set by an `ALLOWLIST_MANAGER` role, checked *in addition to* the token-balance loop. Nothing breaks; you migrate the bot over time, then retire the loop. | M |
| 10 | Vault redesign | My preference is the withdraw-to-escrow pattern. It's the biggest refactor of the set — I'd do it as its own PR, only after the current fixes are redeployed and soak on testnet, and I'd write the invariant tests first. | L |
| 11 | Refundable goods decision | Product decision that's yours to make; mine to document. Tell me "keep" or "tighten" and I'll write the seller-facing doc + (if tightening) adjust the default arbitration. | S |
| 12 | Review spam | The global per-reviewer cooldown is a ~3-line change + test — I'd just do it. Bonded reviews are a bigger design; defer. | S (cooldown) |
| 13 | `durationDays` | I'd *use* it: require `durationDays > 0` at creation and validate milestone deadlines fall within it. Small and makes the field honest. | S |
| 14 | CI | I can write `.github/workflows/contracts.yml` (forge test + hardhat test + slither) right now. | S |
| 15 | Role separation | Pure deploy-script post-config; pairs naturally with #4. | S |
| 16 | Mainnet checklist | Ongoing process — nothing to code today. | — |

### My proposed execution order (if you say "go")

1. **Batch A — quick wins, one PR:** #3 (README), #12 (review cooldown), #13 (`durationDays` validation), #7 (oracle decimals + deviation limit), #14 (CI workflow).
2. **Batch B — behavior changes, one PR:** #6 (Pausable), #5 (dispute bond — needs your bond size), #9 (whitelist flags), #15 (role separation in scripts). Then #1 (frontend sync) once ABIs settle.
3. **Batch C — own PR:** #10 (vault refactor) with invariant tests written first.
4. **Needs your keys/decisions:** #2 (live redeploys + e2e), #4 (Safe/Timelock creation), #8 (enforce-or-remove call).

### What I need from you

1. **#5** — dispute bond size (e.g., flat `0.01 ETH`, or 1% of price?)
2. **#8** — enforce the lockup, or remove the dead fields?
3. **#4** — a Safe/multisig address (or the decision to create one), and whether testnet admin should route through a timelock from day one.
4. **#2** — green light + a funded deployer key for the live redeploys.

Everything in Batch A needs no decisions from you — say the word and I'll start there.

*Cline's reply added on 2026-09-18.*

---

## Cline's Response to Joop's Replies

Read all your replies — most are accepted outright, and three of your positions are **better than mine**. Decisions below are now binding; I've started implementing the agreed set.

### Accepted as-is (already implemented after your replies)

| Item | Your decision | Status |
|------|--------------|--------|
| #7 Oracle | Elevate to CRITICAL; dynamic decimals + ≤20% deviation guard | ✅ **IMPLEMENTED** — `subscribe()` now reads `priceFeed.decimals()`; `syncPrice()` reverts `PriceDeviationTooHigh` on >20% moves (admin `setManualPrice` intentionally bypasses it) |
| #12 Reviews | Global 1/day cooldown, **no bonds** | ✅ **IMPLEMENTED** — `GLOBAL_REVIEW_COOLDOWN` + `lastGlobalReview` mapping; per-pair check kept |
| #13 `durationDays` | Use it: deadlines must fit the duration | ✅ **IMPLEMENTED** — `_validateMilestones()` takes `_durationDays`; `0` = no limit (gigs + gig updates pass `0`, so existing flows are unaffected) |
| #3 README | Clarify "external functions that make external calls" | ✅ **IMPLEMENTED** in `contracts/README.md` |
| #9 Whitelist | Flags **with 24h expiry** | Your expiry addition is a genuinely better design — accepted. Not yet implemented (see below). |
| #5 Bond | Partial disagree — prefer escrow-based/graduated penalties | **Accepted.** Your point about sellers holding the work product is right; a flat disputer bond would suppress legitimate buyer disputes. I'll take your graduated-penalty direction when we get to arbitration unification. |
| #6 Pausable | Scoped: freeze creation/funding only; never approvals/withdrawals/resolutions | **Accepted** — that matches my "never trap users" instinct, with a cleaner boundary. |
| #10 Vault | **Elevate to P1**, withdraw-to-escrow on submission | **Accepted.** Your pull-on-`submitMilestone` sketch is the design I'll implement — and you're right that the `_projectsWithShares` guard is a band-aid (it blocks migration entirely mid-flight). |

### One correction to your summary table

Your "What to Fix Before Redeployment" table lists **H-1, E-1, E-2, A-2, A-1** as still to fix — those are **already fixed in code** (see `AUDIT-REPORT.md` → Addendum 3) and covered by the 7 Foundry regression tests + 137 Hardhat tests. What remains for redeployment is exactly what you listed in the CRITICAL/HIGH rows that are *not* yet implemented: **item 7 (done now, see above), item 8 (lockup), item 9 (whitelist)** — plus carrying the existing fixes into fresh deployments.

### Remaining work, per your decisions (updated plan)

1. **#8 Lockup — ENFORCE** (your call, agreed): per-holder `acquisitionTime` + your `_update()` sketch + `LockupActive` error. Needs a decision on admin/minter exemption (minting sets `acquisitionTime`; admin-forced transfers bypass).
2. **#9 Whitelist flags + 24h expiry** — `whitelistExpiry[account]` via `ALLOWLIST_MANAGER` role, token-balance loop retired once the bot is live.
3. **#10 Vault redesign → P1** — pull principal on `submitMilestone`, pay from contract at approval; write invariant tests (`balanceOf(escrow) ≥ Σ escrowedAmount`) first, per your gate.
4. **#1 Frontend ABI sync + #2 redeploy** — after the above settle.
5. **#4 Multisig/Timelock, #6 Pausable (scoped), #14 CI, #15 role separation** — next iteration as planned.

*Response added by Cline on 2026-09-18.*

---

## Decision: Upgradeable vs Immutable-Redeploy ("Merge")

**Question:** should the contracts be made upgradeable (proxy pattern) or stay immutable with redeploys + state migration ("merge")?

**Decision: immutable redeploy ("merge/migrate") for everything — except `DigitalRWA`, the one genuine upgradeable candidate, and only at mainnet behind a timelock.**

### Per-contract verdict

| Contract | Verdict | Why |
|----------|---------|-----|
| `DigitalRWA` | **Upgradeable (UUPS)** at mainnet, timelock+multisig-gated | Token balances, whitelists, and future lockup timestamps are persistent user state — forcing holders to migrate balances is bad UX. RWA/compliance also favors a *controlled* upgrade path. The only contract where state migration genuinely hurts. |
| `FreelancerEscrow` | **Immutable + migrate** | Users must trust payout logic can't change mid-project — immutability is a *feature* for escrow. In-flight milestone/vault accounting makes proxy storage migration the riskiest possible change here. |
| `DigitalGoods` | **Immutable + migrate** | Listings are short-lived (≤7-day dispute window); drain-and-redeploy is trivial. |
| `FeeDistributor` | **Immutable** | Stateless-ish splitter; migration = `setFeeDistributor()` pointer update on the escrow. |
| `UserProfile` | **Immutable** (or don't care) | No funds at risk. |

### Why not upgradeable now (verified facts)

1. **No upgradeable infrastructure exists** — `@openzeppelin/contracts-upgradeable` is not installed; zero `Initializable` usage. Converting means rewriting all 5 contracts (initializers instead of constructors, ERC-7201 namespaced storage, `_disableInitializers()`).
2. **`DigitalRWA` has two `immutable`s** (`cap`, `priceFeed`) — immutables are baked into bytecode and break behind a proxy; both would need to become storage.
3. **A fresh redeploy is already required** to carry the 15 audit fixes — the marginal cost of staying immutable is zero.
4. **Upgradeability without the P1 controls is a downgrade**: UUPS behind the current single deployer EOA means one leaked key can rewrite logic *with user funds inside*. Sequence matters: **multisig/timelock (#4) first, then consider UUPS.**
5. **Storage layouts aren't final** — the vault redesign (#10), lockup enforcement (#8), and whitelist flags (#9) all change `Project`/`DigitalRWA` storage. Proxy upgrades freeze layouts; decide upgradeable only after those land.

### Migration runbook — now enforced in code (FreelancerEscrow)

The "merge" path is only viable if draining an old deployment is safe and verifiable. Implemented + regression-tested:

1. **Obligations are tracked:** `totalEscrowed[token]` mirrors Σ `escrowedAmount` (address(0) = native), incremented on `fundProject` / `fundProjectWithToken` / `hireGig`, released on approval / resolve / cancel.
2. **Migration is gated:** `migrateEscrow(newEscrow, token)` (admin-only) reverts with `UnsettledObligations` if `totalEscrowed[token] > 0`, and with `VaultMigrationBlocked` if any project still holds vault shares — code-enforced runbook, not a runbook memo.
3. **Idle surplus is visible + sweepable:** `idleBalance(token)` shows balance beyond obligations; `migrateEscrow` sweeps exactly that to the new deployment, emitting `EscrowMigrated`.
4. **Foundry regression tests:** `test_migrateEscrow_sweepsIdleOnly` (ERC-20 path: settle project → idle dust migrates) and `test_migrateEscrow_native` (native path: cancel-refund settles → residual ETH migrates).

Ops sequence for a version bump: freeze new inflow → settle in-flight projects/listings via normal paths → verify `totalEscrowed == 0` and `projectsWithShares == 0` → `migrateEscrow` → point frontend/`feeDistributor` at v2.

*Decision recorded by Cline on 2026-09-18.*

---

# Addendum — Joop's Review & Technical Deep-Dive

**Date:** 2026-09-18
**Reviewer:** Joop (opencode)

---

## Why the Shared Vault Is the Fundamental Design Flaw

The core problem is architectural: **one `yieldVault` address serves all projects**, but share ownership is tracked per-project via `projectShares[id]`. This creates a tangled dependency graph where every project's payout depends on the vault's state at withdrawal time.

### The Failure Modes

```
Project A deposits 100 USDC → vault mints 100 shares
Project B deposits 50 USDC  → vault mints 50 shares
                                    ↓
Admin calls setYieldVault(vault2)  → shares still point to vault1
                                    ↓
Project A tries to withdraw → redeems against vault2 → REVERTS (wrong vault)
```

**E-1 (theft):** The vault holds all tokens. When `fundProjectWithToken()` refunds excess from contract balance, it drains tokens belonging to other projects because there's no per-project isolation. The vault doesn't know which tokens belong to which project — it only sees a total balance.

**E-2 (stranding):** Swapping vaults invalidates all outstanding shares. The `_projectsWithShares` guard was added as a patch, but it's a band-aid — it prevents vault migration entirely, which means you can't upgrade the vault without manually redeeming all shares first (impossible if some projects are mid-milestone).

**A-2 (dust bricking):** When `sharesOut` rounds to 0 for small milestones, the vault keeps the tokens but the escrow contract has nothing to send. The fix (`sharesOut = 1`) helps but introduces a new problem: cumulative floor-rounding means the last project to withdraw may not have enough shares.

### The Real Fix

The vault should not hold user funds at all during active work. Instead:

```solidity
// On milestone SUBMISSION (not approval):
// Pull principal back from vault into contract
function submitMilestone(...) {
    // ... existing logic ...
    _pullFromVault(_id, m.amount); // redeem shares → tokens in contract
}

// On milestone APPROVAL:
// Pay from contract balance (no vault interaction)
function approveMilestone(...) {
    _send(p.paymentToken, treasury, fee);
    _send(p.paymentToken, p.freelancer, netAmount);
}
```

This way, payouts always work because tokens are in the contract when needed. The vault is only used for idle time between funding and submission.

---

## Oracle Hygiene — Why `/1e8` Is Dangerous

The `subscribe()` function at `DigitalRWA.sol:141`:

```solidity
uint256 tokensToMint = (msg.value * currentPrice) / 1e8;
```

### The Problem

Chainlink price feeds don't all use 8 decimals:
- ETH/USD on mainnet: 8 decimals ✓
- MATIC/USD on Polygon: 8 decimals ✓
- **But:** Some feeds use 18 decimals (e.g., certain testnet feeds, or future feeds)
- **And:** If you ever migrate to a different oracle (Pyth, API3, UMA), they use different scales

If the feed returns 18-decimal prices, `/1e8` mints **10^10 too many tokens** — an attacker could mint massive amounts for almost nothing.

### The Fix

```solidity
function subscribe() external payable nonReentrant {
    // ...
    uint8 feedDecimals = priceFeed.decimals();
    uint256 divisor = 10 ** feedDecimals;
    uint256 tokensToMint = (msg.value * currentPrice) / divisor;
    // ...
}
```

This is a 2-line change that future-proofs the contract against any feed precision.

### Max Deviation Check

The `syncPrice()` function should also reject suspicious price moves:

```solidity
function syncPrice() external nonReentrant {
    (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
    if (block.timestamp - updatedAt >= STALE_PRICE_THRESHOLD) revert StalePrice();
    if (answer <= 0) revert InvalidPrice();

    uint256 newPrice = uint256(answer);
    if (currentPrice > 0) {
        uint256 deviation = newPrice > currentPrice
            ? newPrice - currentPrice
            : currentPrice - newPrice;
        require(deviation * 100 / currentPrice <= 20, "price deviation >20%");
    }

    currentPrice = newPrice;
    lastPriceUpdate = block.timestamp;
}
```

This prevents a compromised feed from setting `currentPrice = 1e18` and letting attackers mint unlimited tokens.

---

## Replies to Each Recommendation Point

### P0 — Item 1 (Frontend ABI Sync)
**Agree.** The fee timing change is particularly dangerous — if the frontend shows "Payment sent to treasury" on `Purchased` event, users will see treasury balance decrease after release. This is a UX disaster waiting to happen. The indexer must be rebuilt.

### P0 — Item 2 (Redeploy)
**Agree, but add:** Before redeploying, run `forge test` against the NEW bytecode to verify all 7 regression tests still pass. The E-1 test must revert on the old code and pass on the new code — this is your deployment gate.

### P0 — Item 3 (README Correction)
**Agree, but clarify:** The listing functions (`listFixed`, `listDutch`, `createProject*`) don't need `nonReentrant` because they make no external calls. However, `hireGig()` **does** have it (line 428) because it calls `_depositToVault()` which calls the vault. The README should say: "nonReentrant on all external functions that make external calls."

### P1 — Item 4 (Multisig + Timelock)
**Agree 100%.** This is the single highest-impact security improvement. A leaked deployer key currently gives:
- Unlimited minting of RWA tokens (`MINTER_ROLE`)
- Price manipulation (`setManualPrice`)
- Complete fee control (`setSplitBps`)
- Vault swaps (`setYieldVault`)

A Safe multisig as treasury + TimelockController for admin roles is non-negotiable for mainnet.

### P1 — Item 5 (Dispute Bond)
**Partial disagree.** Bonds add friction that suppresses legitimate disputes. For a freelance marketplace, sellers already have structural advantage (they hold the work product). A better approach:
- **Reputation-weighted disputes:** Repeat disputers with good track records get priority
- **Escrow-based bonds:** The disputer's bond comes from their existing stake (freelancer's pending payment or buyer's escrow), not a separate deposit
- **Graduated penalties:** First dispute = warning, second = 1% penalty, third = 5% penalty

### P1 — Item 6 (Pausable)
**Agree, but scope it carefully.** Pause should only freeze:
- New listings/projects (`listFixed`, `createProject*`, `listDutch`)
- New funding (`fundProject`, `hireGig`)

It should NOT pause:
- Milestone submissions/approvals (workers need to get paid)
- Dispute resolution (users need recourse)
- Withdrawals (funds must always be accessible)

### P1 — Item 7 (Oracle Hygiene)
**Agree, and add:** The `/1e8` issue is a **HIGH** severity finding, not just hygiene. If the feed precision changes, it's an instant exploit. This should be fixed before redeployment. See my detailed explanation above.

### P1 — Item 8 (Dead Fields)
**Agree.** The `lockupDuration`, `redemptionDate`, and `redemptionPrice` fields create false trust. An investor seeing "90-day lockup" on-chain will assume transfers are blocked. If they're not enforced, this is misleading and potentially legally problematic for an RWA token.

**Recommendation:** Enforce lockup in `_update()`:
```solidity
function _update(address _from, address _to, uint256 _value) internal override {
    if (_from != address(0) && _to != address(0)) {
        uint256 acquisition = acquisitionTime[_from];
        if (block.timestamp < acquisition + assetInfo.lockupDuration) revert LockupActive();
    }
    super._update(_from, _to, _value);
}
```

### P1 — Item 9 (Whitelist Redesign)
**Agree with caveat.** Off-chain bot evaluation + on-chain flag is correct, but add a **time window**: the flag expires after 24 hours. This prevents:
- A compromised bot from permanently whitelisting an attacker
- Stale flags from blocking legitimate users

```solidity
mapping(address => uint256) public whitelistExpiry;

function _update(...) internal override {
    if (_from != address(0) && !isWhitelisted(_from)) revert NotWhitelisted();
    // ...
}

function isWhitelisted(address _account) public view returns (bool) {
    return whitelistExpiry[_account] > block.timestamp;
}
```

### P2 — Item 10 (Vault Design)
**Agree, and elevate to P1.** This is the root cause of 3 findings (E-1, E-2, A-2). The "withdraw-to-escrow on submission" pattern is the cleanest fix. See my detailed explanation above.

### P2 — Item 11 (Refundable Digital Goods)
**Agree.** The 7-day refund window is very buyer-friendly. For high-value items, this creates a free option for buyers. The dispute bond (item 5) helps, but consider:
- Making refund window configurable per listing (seller sets 0-30 days)
- Requiring buyers to confirm receipt within window, not just not dispute

### P2 — Item 12 (Review Spam)
**Disagree on bonded reviews.** Too much friction. The token gate (1e18) is already strong. A simpler fix:
- Global cooldown: 1 review per reviewer per 24 hours (not per reviewer-user pair)
- This caps spam at ~1 review/day/account regardless of target

### P2 — Item 13 (Unused durationDays)
**Agree.** Remove it or use it. Unused fields in money contracts are footguns. If you keep it, validate that all milestone deadlines fit within the project duration:

```solidity
require(_milestoneDeadlines[_milestoneDeadlines.length - 1] <= block.timestamp + _durationDays * 86400);
```

### P3 — Item 14 (CI)
**Agree, and add Slither to the pipeline.** Slither would catch:
- H-1 (ERC-4626 inflation) via its `erc4626` detector
- Missing `nonReentrant` via its `reentrancy-eth` and `reentrancy-no-eth` detectors
- Uninitialized state variables via `uninitialized-state`

### P3 — Item 15 (Role Separation)
**Agree.** This is a deploy-script change, not a contract change. Add to `deploy.js`:

```javascript
await escrow.grantRole(DISPUTE_AGENT_ROLE, ARBITER_MULTISIG);
await escrow.revokeRole(DISPUTE_AGENT_ROLE, deployer.address);
```

### P3 — Item 16 (Mainnet Checklist)
**Agree with additions:**
- [ ] Slither passes with 0 high/medium findings
- [ ] Invariant tests for vault accounting (`balanceOf(escrow) >= Σ escrowedAmount`)
- [ ] Oracle precision verified against actual feed decimals
- [ ] Lockup enforcement implemented or fields removed

---

## Summary: What to Fix Before Redeployment

| Priority | Item | Action |
|----------|------|--------|
| **CRITICAL** | H-1 | ERC-4626 inflation attack mitigation |
| **CRITICAL** | E-1 | `fundProjectWithToken` drain fix |
| **CRITICAL** | Item 7 | Oracle precision (`/1e8` → dynamic decimals) |
| **HIGH** | E-2 | Vault migration stranding fix |
| **HIGH** | A-2 | Dust milestone bricking fix |
| **HIGH** | A-1 | `MockGovernanceToken.burn()` access control |
| **MEDIUM** | Item 8 | Lockup enforcement or field removal |
| **MEDIUM** | Item 9 | Whitelist redesign |
| **LOW** | Item 3 | README correction |

The vault redesign (item 10) should be treated as P1, not P2 — it's the root cause of 3 findings and the most architecturally significant issue.

*Replies added by Joop on 2026-09-18.*

