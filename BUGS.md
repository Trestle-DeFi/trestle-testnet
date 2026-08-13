# Trestle Testnet — Bug Report

> Generated: 2026-08-13
> Repos: `jweb3-org/trestle-testnet` (Trestle-DeFi) & `jweb3-git` (jooweb3)

---

## CRITICAL

### C1. `resolveAfterTimeout` emits wrong `toBuyer` value
- **File:** `contracts/src/DigitalGoods.sol:229`
- **Both repos:** Yes
- **Bug:** After the disputed branch sets `l.status = ListingStatus.Refunded` (line 226), the emit on line 229 checks `l.status == ListingStatus.Sold` — which is always `false`. So `Resolved` event always reports `toBuyer = false` for refund cases, even though funds went to the buyer.
- **Fix:** Capture resolution direction before mutating status:
  ```solidity
  bool toSeller = l.status == ListingStatus.Sold;
  // ... mutate status ...
  emit Resolved(_id, toSeller);
  ```

### C2. No token allowlist — `buyWithToken` / `fundProjectWithToken` accept any ERC-20
- **File:** `contracts/src/DigitalGoods.sol:163`, `contracts/src/FreelancerEscrow.sol:379`
- **Both repos:** Yes
- **Bug:** Both functions accept any `_token` address with no validation. A malicious ERC-20 could implement callbacks or reentrancy hooks. Tests call `setTokenAllowed()` (Heavy.test.js:440, 697) but this function was **never implemented** in either contract.
- **Fix:** Add `mapping(address => bool) public allowedTokens` + `setTokenAllowed` admin function. Validate `_token` in both functions.

### C3. `FeeDistributor.distribute` has no reentrancy guard
- **File:** `contracts/src/FeeDistributor.sol:61`
- **Both repos:** Yes
- **Bug:** `distribute()` makes external calls via `_transfer` (ETH `.call{value}` and ERC-20 `safeTransfer`) to arbitrary addresses (`yieldVault`, `treasury`, `buybackBurn`) without `ReentrancyGuard`. A malicious recipient could reenter.
- **Fix:** Import `ReentrancyGuard` and add `nonReentrant` to `distribute()`.

### C4. Tests call nonexistent `setTokenAllowed` — 2 tests always fail
- **File:** `contracts/test/Heavy.test.js:440, 697`
- **Both repos:** Yes
- **Bug:** `digitalGoods.connect(deployer).setTokenAllowed(...)` and `freelancerEscrow.connect(deployer).setTokenAllowed(...)` revert with "function not found". Token purchase paths are completely untested.
- **Fix:** Implement `setTokenAllowed` in contracts, or remove the calls from tests.

---

## HIGH

### H1. `resolveDispute` bypasses platform fee
- **File:** `contracts/src/FreelancerEscrow.sol:470-482`
- **Both repos:** Yes
- **Bug:** When a dispute is resolved by the agent, the full `p.escrowedAmount` goes to the winner with zero fee deduction. Normal milestone approvals charge `PLATFORM_FEE_BPS` (3%). This inconsistency means disputes bypass platform revenue.
- **Fix:** Deduct `PLATFORM_FEE_BPS` from the dispute resolution payout before sending to winner.

### H2. `metadataURI` is `bytes32` — truncates IPFS hashes
- **File:** `contracts/src/DigitalRWA.sol:25`
- **Both repos:** Yes
- **Bug:** `bytes32` holds 32 bytes, but IPFS CIDv0 (Qm...) and CIDv1 hashes are ~46 characters. Metadata URIs are silently truncated.
- **Fix:** Change `bytes32 public metadataURI` to `string public metadataURI`. Update `setMetadataURI` accordingly.

### H3. Frontend `parseMilestones` — deadlines array not sliced
- **File:** `frontend/src/views/Freelance.tsx:44`
- **Both repos:** Yes
- **Bug:** `deadlines: du.map(...)` maps the full `durs` array without slicing to `n`. If descriptions has 2 items and durations has 3, the contract call gets 2 descriptions, 2 amounts, and 3 deadlines → revert.
- **Fix:** `deadlines: du.slice(0, n).map(s => ...)`

### H4. Frontend ABI mismatch — `setWhitelist` should be `setManualWhitelist`
- **File:** `frontend/src/hooks/useContracts.ts:41` and `frontend/src/views/RWA.tsx:108`
- **jweb-git only** (fixed in jweb3-org)
- **Bug:** ABI has `setWhitelist` but contract has `setManualWhitelist`. Admin whitelist function reverts at runtime.

### H5. Frontend ABI — duplicate `whitelisted` entry
- **File:** `frontend/src/hooks/useContracts.ts:37`
- **jweb-git only** (fixed in jweb3-org)
- **Bug:** `whitelisted` function in ABI doesn't exist in contract. `isWhitelisted` (line 36) is the correct function. Extra entry will fail if called.

### H6. FreelancerEscrow `_validateMilestones` doesn't check deadline order
- **File:** `contracts/src/FreelancerEscrow.sol:139`
- **Both repos:** Yes
- **Bug:** Milestone deadlines can be in any order. A milestone with tomorrow's deadline could be listed before one with next week's deadline — semantically incorrect for sequential work.
- **Fix:** Add `require(_milestoneDeadlines[i] >= _milestoneDeadlines[i-1])` after the first milestone.

---

## MEDIUM

### M1. All errors silently swallowed — no user feedback
- **Files:** All frontend views (`Marketplace.tsx`, `Faucet.tsx`, `RWA.tsx`, `UserProfile.tsx`)
- **Both repos:** Yes
- **Bug:** Every `catch` block does `console.error(e)` with no visible feedback. Users see busy state clear but no error message.
- **Fix:** Add error state + display error messages (toast, banner, or inline).

### M2. Zero NatSpec documentation across all contracts
- **Files:** All `.sol` files
- **Both repos:** Yes
- **Bug:** Not a single `@notice`, `@dev`, `@param`, or `@return` comment. Hurts auditability and integration.
- **Fix:** Add NatSpec to all public/external functions, events, errors.

### M3. Pervasive `as any` casts in useContracts hook
- **File:** `frontend/src/hooks/useContracts.ts:94, 112, 114, 116, 118, 120, 126, 128, 130, 132, 134, 136, 142, 144, 146, 152, 154`
- **Both repos:** Yes
- **Bug:** Nearly every contract write call is cast through `as any`, eliminating all TypeScript type checking.
- **Fix:** Use proper wagmi/viem typed hooks or generate typed ABIs with `typechain`.

### M4. Hardcoded "MATIC" in Dashboard
- **File:** `frontend/src/views/Dashboard.tsx:51, 114`
- **Both repos:** Yes
- **Bug:** Line 51 filters `t.token.symbol !== "MATIC"` (Polygon-specific). Line 114 displays "MATIC" as label. On Base/Arbitrum the native token is ETH.
- **Fix:** Use `chainCurrency` from `useContracts()` instead.

### M5. QR codes depend on third-party API
- **Files:** `frontend/src/components/QRCode.tsx:13`, `QRIcon.tsx:36`
- **Both repos:** Yes
- **Bug:** QR generation uses `api.qrserver.com`. If it goes down, QR codes break. Also sends scanned URL to a third party (privacy concern).
- **Fix:** Use client-side QR library like `qrcode.react`.

### M6. `DigitalRWA._update` has redundant condition
- **File:** `contracts/src/DigitalRWA.sol:177`
- **Both repos:** Yes
- **Bug:** `_from != address(0) && _from != address(0)` checks the same condition twice. Line 176 already checks `_from != address(0) && !isWhitelisted(_from)`.
- **Fix:** Simplify or remove redundant line.

### M7. `FeeDistributor` allows zero buyback share
- **File:** `contracts/src/FeeDistributor.sol:54-58`
- **Both repos:** Yes
- **Bug:** `setSplitBps` only validates `_yieldBps + _treasuryBps == BPS`. Owner could set `6000, 4000` leaving buyback with 0. No minimum share enforced.
- **Fix:** Add minimum share check or document that zero is intentional.

### M8. Massive code duplication in Marketplace.tsx
- **File:** `frontend/src/views/Marketplace.tsx:263-357`
- **Both repos:** Yes
- **Bug:** Listing card JSX is duplicated ~90 lines between real listings and example listings blocks.
- **Fix:** Extract a `ListingCard` component.

### M9. `subscribe()` mints 1:1 ignoring oracle price
- **File:** `contracts/src/DigitalRWA.sol:102-107`
- **Both repos:** Yes
- **Bug:** `subscribe()` mints `msg.value` tokens directly (1 ETH = 1 token), ignoring `currentPrice` from Chainlink oracle. Oracle data is unused in the minting flow.
- **Fix:** Use `currentPrice` for minting calculations, or document why oracle is decoupled.

### M10. No React error boundary
- **File:** `frontend/src/app/providers.tsx`
- **Both repos:** Yes
- **Bug:** No error boundary wraps the app. Any component throw crashes the entire page to blank.
- **Fix:** Add error boundary component around `{children}`.

---

## LOW

### L1. `MockGovernanceToken.mint()` has no access control
- **File:** `contracts/src/MockGovernanceToken.sol:19`
- **Both repos:** Yes
- **Bug:** Anyone can mint unlimited tokens. Dangerous if accidentally deployed to mainnet.
- **Fix:** Add `onlyOwner` or explicit test-only comment.

### L2. `MockGovernanceToken.burn()` has no authorization check
- **File:** `contracts/src/MockGovernanceToken.sol:23`
- **Both repos:** Yes
- **Bug:** Anyone can burn anyone's tokens without approval.
- **Fix:** Add `require(msg.sender == _from || isApprovedForAll(...))`.

### L3. `UserProfile.getReviews` has no limit cap
- **File:** `contracts/src/UserProfile.sol:69`
- **Both repos:** Yes
- **Bug:** `_limit` parameter is uncapped. Very large values could cause out-of-gas on reads.
- **Fix:** Cap `_limit` to a maximum (e.g., 50).

### L4. `.gitignore` incorrectly ignores `test/`, `scripts/`, `verify/`
- **Files:** `contracts/.gitignore:4-5`, `.gitignore:8,13`
- **Both repos:** Yes
- **Bug:** Test files, deploy scripts, and verification files are gitignored, making them impossible to commit without `-f`.
- **Fix:** Remove `test/`, `scripts/`, `verify/` from gitignore.

### L5. Hardcoded constants should be configurable
- **Files:** All contracts (`DISPUTE_TIMEOUT`, `PLATFORM_FEE_BPS`, `MIN_MILESTONES`, etc.)
- **Both repos:** Yes
- **Bug:** All protocol constants are hardcoded. Changing them requires full redeployment.
- **Fix:** Convert to storage variables with admin setters bounded by min/max.

### L6. `_releaseToSeller` / `_releaseToBuyer` emit no events
- **File:** `contracts/src/DigitalGoods.sol:241-265`
- **Both repos:** Yes
- **Bug:** No event emitted when escrowed funds are released. Hard for indexers to track fund flows.
- **Fix:** Add `FundsReleased(uint256 indexed id, address indexed recipient, uint256 amount)`.

### L7. `buy()` refund could be front-run / stuck
- **File:** `contracts/src/DigitalGoods.sol:154-158`
- **Both repos:** Yes
- **Bug:** Overpayment refund uses `msg.sender.call{value}`. If buyer is a contract that rejects ETH, the entire transaction reverts, locking the listing in `Sold` state.
- **Fix:** Use `PullPayment` pattern or allow admin/seller to trigger refund.

### L8. Missing security headers in next.config.ts
- **File:** `frontend/next.config.ts`
- **Both repos:** Yes
- **Bug:** No Content-Security-Policy, X-Frame-Options, or other security headers.
- **Fix:** Add security headers configuration.

### L9. `web3.ts` silently fails with empty projectId
- **File:** `frontend/src/config/web3.ts:6`
- **Both repos:** Yes
- **Bug:** `process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ""` falls back to empty string. Wallet connection silently fails with no error.
- **Fix:** Add runtime check and console error.

### L10. No transaction confirmation UX
- **Files:** All views
- **Both repos:** Yes
- **Bug:** After submitting a tx, users only see a hash link. No pending/confirmed/failed status indicator or toast notification.
- **Fix:** Use `waitForTransaction` with status callbacks.

---

## Summary

| Severity | Count | Fixed in jweb3-org |
|----------|-------|-------------------|
| CRITICAL | 4 | 0 (C4 partially — tests still fail) |
| HIGH | 6 | 2 (H4, H5) |
| MEDIUM | 10 | 0 |
| LOW | 10 | 0 |
| **Total** | **30** | **2** |
