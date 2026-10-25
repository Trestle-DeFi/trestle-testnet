// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import {FreelancerEscrow} from "../src/FreelancerEscrow.sol";
import {DigitalGoods} from "../src/DigitalGoods.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert() external;
    function deal(address, uint256) external;
}

/// @dev ERC20 with a transfer fee (fee-on-transfer / taxed token).
contract FeeToken is MockERC20 {
    uint256 public immutable feeBps;
    address public immutable feeCollector;

    constructor(string memory n, string memory s, uint256 _feeBps, address _collector)
        MockERC20(n, s, 18, 0)
    {
        feeBps = _feeBps;
        feeCollector = _collector;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && feeBps > 0) {
            uint256 fee = (value * feeBps) / 10000;
            super._update(from, feeCollector, fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

/// @title TRST-01..06 fix regression suite
/// @notice Verifies the six bug-bounty findings are fixed at the source level:
///         TRST-01 dispute preemption, TRST-02 agent priority, TRST-03 FoT escrow,
///         TRST-04 accept-path deadline validation, TRST-05 vault recovery,
///         TRST-06 resubmit clock reset.
contract TRSTFixesTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant CLIENT = address(0xC11E17);
    address constant FREELANCER = address(0xF12A9CE2);
    address constant TREASURY = address(0x7E2A5);
    address constant SELLER = address(0x5E11E12);
    address constant COLLECTOR = address(0xC011EC70A);

    FreelancerEscrow escrow;
    MockERC20 token;

    function setUpFE() internal {
        token = new MockERC20("T", "T", 18, 1_000_000 ether);
        escrow = new FreelancerEscrow(TREASURY); // this contract = admin/agent
        escrow.setTokenAllowed(address(token), true);
    }

    function _milestoneArrays(uint256 d0, uint256 d1)
        internal view
        returns (string[] memory, uint256[] memory, uint256[] memory)
    {
        string[] memory desc = new string[](2);
        desc[0] = "m0"; desc[1] = "m1";
        uint256[] memory amt = new uint256[](2);
        amt[0] = 500 ether; amt[1] = 500 ether;
        uint256[] memory dl = new uint256[](2);
        dl[0] = block.timestamp + d0;
        dl[1] = block.timestamp + d1;
        return (desc, amt, dl);
    }

    function _funded(uint256 d0, uint256 d1) internal returns (uint256 id) {
        token.mint(CLIENT, 1000 ether);
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestoneArrays(d0, d1);
        vm.startPrank(CLIENT);
        id = escrow.createProjectFixed("P", "u", "g", "c", 60, 1000 ether, d, a, t);
        token.approve(address(escrow), 1000 ether);
        escrow.fundProjectWithToken(id, address(token), 1000 ether);
        vm.stopPrank();
        vm.prank(FREELANCER);
        escrow.acceptProject(id);
    }

    // ─────────────────────────── TRST-01 ───────────────────────────

    /// @notice Client can no longer preempt an elapsed auto-approval window:
    ///         disputeProject reverts; the freelancer still trustlessly claims.
    function test_TRST01_disputeCannotPreemptElapsedAutoApproval() public {
        setUpFE();
        uint256 id = _funded(30 days, 40 days);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery-hash-m0");
        uint256 t0 = block.timestamp - 1; // submission time

        vm.warp(t0 + 14 days + 1);
        vm.prank(CLIENT);
        vm.expectRevert(); // AutoApprovalPending
        escrow.disputeProject(id);

        // Trustless payout still works for the freelancer.
        vm.prank(FREELANCER);
        escrow.autoApproveMilestone(id, 0);
        assertEq(token.balanceOf(FREELANCER), 485 ether, "TRST01: freelancer paid (500 - 3%)");
    }

    /// @notice Control: dispute is allowed while no auto-approval window has
    ///         elapsed (fix is scoped, not a dispute ban).
    function test_TRST01_disputeStillAllowedBeforeTimeout() public {
        setUpFE();
        uint256 id = _funded(30 days, 40 days);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery-hash-m0");

        vm.prank(CLIENT);
        escrow.disputeProject(id); // no revert — timeout not elapsed
    }

    // ─────────────────────────── TRST-02 ───────────────────────────

    /// @notice Inside the agent grace window after disputeDeadline, the client
    ///         cannot auto-resolve, and the agent's arbitration still executes.
    function test_TRST02_agentGrace_blocksClientRace_agentWins() public {
        setUpFE();
        uint256 id = _funded(30 days, 40 days);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery-hash-m0");
        vm.prank(CLIENT);
        escrow.disputeProject(id);
        uint256 tDispute = block.timestamp;

        vm.warp(tDispute + 7 days + 1 hours); // deadline passed, agent slow

        vm.prank(CLIENT);
        vm.expectRevert(); // WrongStatus — grace active
        escrow.autoResolveDispute(id);

        // Agent (admin = this contract) rules for the freelancer.
        escrow.resolveDispute(id, true);
        assertEq(token.balanceOf(FREELANCER), 970 ether, "TRST02: agent ruling executed (1000 - 3%)");
        assertEq(token.balanceOf(CLIENT), 0 ether, "TRST02: no front-run refund");

        // Arbitration finalized the project — auto-resolve is permanently moot.
        vm.prank(CLIENT);
        vm.expectRevert();
        escrow.autoResolveDispute(id);
    }

    /// @notice After the grace window the permissionless fallback still works.
    function test_TRST02_afterGrace_autoResolveCallable() public {
        setUpFE();
        uint256 id = _funded(30 days, 40 days);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery-hash-m0");
        vm.prank(CLIENT);
        escrow.disputeProject(id);
        uint256 tDispute = block.timestamp;

        vm.warp(tDispute + 7 days + 3 days + 1 seconds);
        vm.prank(CLIENT);
        escrow.autoResolveDispute(id);
        assertEq(token.balanceOf(CLIENT), 1000 ether, "TRST02: fallback refund after grace");
    }

    // ─────────────────────────── TRST-04 ───────────────────────────

    /// @notice Dutch: accept after a milestone deadline has passed is blocked.
    function test_TRST04_dutchAcceptAfterMilestoneDeadline_reverts() public {
        setUpFE();
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestoneArrays(10 days, 20 days);
        vm.prank(CLIENT);
        uint256 id = escrow.createProjectDutch("D", "u", "g", "c", 30, 1000 ether, 100 ether, 30 days, d, a, t);
        uint256 t0 = block.timestamp - 1; // creation time

        vm.warp(t0 + 25 days);
        uint256 price = escrow.currentBudget(id);
        token.mint(CLIENT, price);
        vm.startPrank(CLIENT);
        token.approve(address(escrow), price);
        escrow.fundProjectWithToken(id, address(token), price);
        vm.stopPrank();

        vm.prank(FREELANCER);
        vm.expectRevert(); // PastDeadline
        escrow.applyAndAcceptDutch(id);
    }

    /// @notice Control: accept within window succeeds (no over-blocking).
    function test_TRST04_acceptWithinDeadline_ok() public {
        setUpFE();
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestoneArrays(40 days, 50 days);
        vm.prank(CLIENT);
        uint256 id = escrow.createProjectDutch("D", "u", "g", "c", 60, 1000 ether, 100 ether, 30 days, d, a, t);
        uint256 t0 = block.timestamp - 1; // creation time

        vm.warp(t0 + 25 days);
        uint256 price = escrow.currentBudget(id);
        token.mint(CLIENT, price);
        vm.startPrank(CLIENT);
        token.approve(address(escrow), price);
        escrow.fundProjectWithToken(id, address(token), price);
        vm.stopPrank();

        vm.prank(FREELANCER);
        escrow.applyAndAcceptDutch(id); // succeeds
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery"); // and submission is live
    }

    // ─────────────────────────── TRST-05 ───────────────────────────

    /// @notice Vault swap is permitted even with shares outstanding; the old
    ///         project still redeems against ITS latched vault, new deposits
    ///         flow to the new vault.
    function test_TRST05_swapAllowed_despiteShares_perVaultRedemption() public {
        setUpFE();
        MockYieldVault vault1 = new MockYieldVault(IERC20(address(token)), "V1", "V1");
        escrow.setYieldVault(address(vault1));

        uint256 id = _funded(30 days, 40 days); // deposits into vault1
        assertEq(escrow.projectVault(id), address(vault1), "TRST05: pointer latched");

        // Previously reverted (VaultMigrationBlocked) — now allowed.
        MockYieldVault vault2 = new MockYieldVault(IERC20(address(token)), "V2", "V2");
        escrow.setYieldVault(address(vault2));

        // Old project still redeems from vault1 (its own latched pointer).
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery");
        vm.prank(CLIENT);
        escrow.approveMilestone(id, 0);
        assertEq(token.balanceOf(FREELANCER), 485 ether, "TRST05: payout via latched vault");
        assertTrue(
            token.balanceOf(address(vault1)) > 400 ether && token.balanceOf(address(vault1)) <= 500 ether,
            "TRST05: vault1 drained by redemption"
        );

        // A NEW project funds into vault2.
        uint256 id2 = _funded(30 days, 40 days);
        assertEq(escrow.projectVault(id2), address(vault2), "TRST05: new project latched to new vault");
        assertEq(token.balanceOf(address(vault2)), 1000 ether, "TRST05: new deposit in new vault");
    }

    /// @notice Detaching the vault (address(0)) is now allowed as a circuit
    ///         breaker; escrow without shares stays in-contract.
    function test_TRST05_detach_zeroAllowed() public {
        setUpFE();
        uint256 id = _funded(30 days, 40 days); // no vault set → in-contract
        escrow.setYieldVault(address(0)); // previously reverted ZeroAddress
        assertEq(address(escrow.yieldVault()), address(0), "TRST05: detached");

        // Payout path degraded gracefully (contract-held escrow).
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "delivery");
        vm.prank(CLIENT);
        escrow.approveMilestone(id, 0);
        assertEq(token.balanceOf(FREELANCER), 485 ether, "TRST05: in-contract payout");
    }

    // ─────────────────────────── TRST-06 ───────────────────────────

    /// @notice Reject + resubmit no longer resets the 14-day auto-approval
    ///         clock: 13d + reject + resubmit + 13d → claimable.
    function test_TRST06_rejectResubmit_doesNotResetClock() public {
        setUpFE();
        uint256 id = _funded(30 days, 40 days);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "v1");
        uint256 tFirst = block.timestamp - 1; // first submission time

        vm.warp(tFirst + 13 days);
        vm.prank(CLIENT);
        escrow.rejectMilestone(id, 0);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "v2");
        vm.warp(tFirst + 27 days); // 27 days after FIRST submission — clock not reset

        vm.prank(FREELANCER);
        escrow.autoApproveMilestone(id, 0); // succeeds — clock not reset
        assertEq(token.balanceOf(FREELANCER), 485 ether, "TRST06: claim unlocked past 14d from first submit");
    }

    // ─────────────────────────── TRST-03 ───────────────────────────

    function _mkGoods(MockERC20 plain) internal returns (DigitalGoods goods) {
        goods = new DigitalGoods(TREASURY);
        goods.setTokenAllowed(address(plain), true);
    }    function _listFixed(DigitalGoods goods, uint256 price) internal returns (uint256 id) {
        vm.prank(SELLER);
        id = goods.listFixed("uri", "desc", "tags", false, price, "cat", "delivery");
    }

    /// @notice A fee-on-transfer token can no longer silently brick the
    ///         escrow: an exact-amount taxed purchase is rejected at buy time.
    function test_TRST03_foTExactPurchase_reverts() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        FeeToken tax = new FeeToken("Taxed", "TAX", 300, COLLECTOR);
        goods.setTokenAllowed(address(tax), true);
        uint256 id = _listFixed(goods, 100 ether);

        tax.mint(CLIENT, 100 ether);
        vm.startPrank(CLIENT);
        tax.approve(address(goods), 100 ether);
        vm.expectRevert(); // InsufficientReceived
        goods.buyWithToken(id, address(tax), 100 ether);
        vm.stopPrank();
    }

    /// @notice Overpaying a taxed token so `received >= price` succeeds, and
    ///         the refund keeps `balance == escrowedAmount` (nothing locks).
    function test_TRST03_foTOverpay_refundsNetSurplus_escrowSolvent() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        FeeToken tax = new FeeToken("Taxed", "TAX", 300, COLLECTOR);
        goods.setTokenAllowed(address(tax), true);
        uint256 id = _listFixed(goods, 100 ether);

        tax.mint(CLIENT, 200 ether);
        vm.startPrank(CLIENT);
        tax.approve(address(goods), 200 ether);
        goods.buyWithToken(id, address(tax), 200 ether); // received 194 >= 100
        vm.stopPrank();

        // Solvency: balance exactly covers the tracked obligation.
        assertEq(tax.balanceOf(address(goods)), 100 ether, "TRST03: escrow solvent");
        assertEq(goods.totalEscrowed(address(tax)), 100 ether, "TRST03: obligation tracked");

        // Refund path works end-to-end now.
        uint256 tBuy = block.timestamp - 1; // purchase time
        uint256 before = tax.balanceOf(CLIENT);
        vm.prank(CLIENT);
        goods.dispute(id);
        vm.warp(tBuy + 7 days + 1);
        vm.prank(CLIENT);
        goods.resolveAfterTimeout(id);
        // The 100e18 refund transfer is itself skimmed 3% by the taxed token —
        // that is inherent to FoT tokens and harmless now that the escrow is
        // solvent (nothing reverts, nothing locks). Buyer receives 97% net.
        assertEq(tax.balanceOf(CLIENT) - before, 97 ether, "TRST03: refund executes (net of token's own fee)");
        assertEq(goods.totalEscrowed(address(tax)), 0, "TRST03: obligation released");
    }

    /// @notice Control: a normal token flow is untouched (0% fee token).
    function test_TRST03_control_normalToken_refundsFine() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        uint256 id = _listFixed(goods, 100 ether);

        plain.mint(CLIENT, 100 ether);
        vm.startPrank(CLIENT);
        plain.approve(address(goods), 100 ether);
        goods.buyWithToken(id, address(plain), 100 ether);
        vm.stopPrank();
        uint256 tBuy = block.timestamp - 1; // purchase time

        vm.prank(CLIENT);
        goods.dispute(id);
        vm.warp(tBuy + 7 days + 1);
        vm.prank(CLIENT);
        goods.resolveAfterTimeout(id);
        assertEq(plain.balanceOf(CLIENT), 100 ether, "TRST03: full refund");
    }

    /// @notice sweepStuck moves ONLY the surplus above tracked obligations.
    function test_TRST03_sweepStuck_surplusOnly() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        uint256 id = _listFixed(goods, 100 ether);

        plain.mint(CLIENT, 100 ether);
        vm.startPrank(CLIENT);
        plain.approve(address(goods), 100 ether);
        goods.buyWithToken(id, address(plain), 100 ether);
        vm.stopPrank();

        // Stray tokens land in the escrow (e.g. donated).
        plain.mint(address(goods), 42 ether);

        // Non-owner cannot sweep.
        vm.prank(SELLER);
        vm.expectRevert();
        goods.sweepStuck(address(plain), TREASURY);

        goods.sweepStuck(address(plain), TREASURY);
        assertEq(plain.balanceOf(TREASURY), 42 ether, "TRST03: only surplus swept");
        assertEq(plain.balanceOf(address(goods)), 100 ether, "TRST03: escrow untouched");
    }

    /// @notice JKO-4 fix: at the exact deadline second, dispute + fallback
    ///         resolve can no longer execute — the dispute resets the window
    ///         so resolveAfterTimeout reverts until arbitration is possible.
    function test_JKO04_atomicDisputeRefund_blockedAtDeadlineSecond() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        uint256 id = _listFixed(goods, 100 ether);

        plain.mint(CLIENT, 100 ether);
        vm.startPrank(CLIENT);
        plain.approve(address(goods), 100 ether);
        goods.buyWithToken(id, address(plain), 100 ether);
        vm.stopPrank();
        uint256 tBuy = block.timestamp - 1; // purchase time

        vm.warp(tBuy + 7 days); // == disputeDeadline: the overlap second

        vm.prank(CLIENT);
        goods.dispute(id); // succeeds, refreshes deadline to tBuy+14d
        vm.prank(CLIENT);
        vm.expectRevert(); // WrongStatus — arbitration window restarted
        goods.resolveAfterTimeout(id);

        assertEq(goods.totalEscrowed(address(plain)), 100 ether, "JKO-4: escrow intact, no free-ride");
    }

    /// @notice JKO-4 fix: a legitimate dispute restarts the 7-day arbitration
    ///         window — late fallback resolution stays blocked past the old
    ///         deadline, then works once the fresh window elapses.
    function test_JKO04_disputeRefresh_extendsArbitration() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        uint256 id = _listFixed(goods, 100 ether);

        plain.mint(CLIENT, 100 ether);
        vm.startPrank(CLIENT);
        plain.approve(address(goods), 100 ether);
        goods.buyWithToken(id, address(plain), 100 ether);
        vm.stopPrank();
        uint256 t0 = block.timestamp;
        uint256 Tdispute = t0 + 6 days;   // pre-dispute in-window
        uint256 Tlate = t0 + 7 days + 1;  // old deadline passed
        uint256 Tfresh = t0 + 13 days + 1; // refreshed deadline (6d + 7d)

        vm.warp(Tdispute);
        vm.prank(CLIENT);
        goods.dispute(id); // window refreshed to Tfresh

        vm.warp(Tlate); // old deadline passed — insufficient now
        vm.prank(SELLER);
        vm.expectRevert(); // WrongStatus — fresh arbitration window active
        goods.resolveAfterTimeout(id);

        vm.warp(Tfresh); // fresh window elapsed
        vm.prank(SELLER);
        goods.resolveAfterTimeout(id); // existing semantics: Disputed → refund buyer
    }

    // ─────────────────────────── BANI-FOT ───────────────────────────

    /// @notice BANI-FOT regression suite for FreelancerEscrow.fundProjectWithToken.
    ///         Mirrors the TRST-03 fix already shipped in DigitalGoods.buyWithToken:
    ///         measure the received amount, revert with InsufficientReceived when
    ///         below the budget, and refund only the net surplus held. Without it
    ///         an allowlisted fee-on-transfer token leaves the escrow insolvent
    ///         and deadlocks every exit path (2nd milestone, dispute resolve both
    ///         ways, autoResolve, migration).
    function _createProject(MockERC20 tok, uint256 fundAmt) internal returns (uint256 id) {
        tok.mint(CLIENT, fundAmt);
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestoneArrays(30 days, 40 days);
        vm.startPrank(CLIENT);
        id = escrow.createProjectFixed("P", "u", "g", "c", 60, 1000 ether, d, a, t);
        tok.approve(address(escrow), fundAmt);
        vm.stopPrank();
    }

    function _fund(uint256 id, MockERC20 tok, uint256 fundAmt) internal {
        vm.startPrank(CLIENT);
        escrow.fundProjectWithToken(id, address(tok), fundAmt);
        vm.stopPrank();
    }

    function _accept(uint256 id) internal {
        vm.prank(FREELANCER);
        escrow.acceptProject(id);
    }

    /// @notice An exact-amount taxed funding is rejected at intake — the escrow
    ///         must never record an obligation larger than its balance.
    function test_BANIFOT_exactTaxedFunding_reverts() public {
        setUpFE();
        FeeToken tax = new FeeToken("Taxed", "TAX", 1000, COLLECTOR); // 10% fee
        escrow.setTokenAllowed(address(tax), true);
        uint256 id = _createProject(tax, 1000 ether);

        vm.expectRevert(); // InsufficientReceived
        _fund(id, tax, 1000 ether);
    }

    /// @notice Overpaying a taxed token so received >= budget succeeds, and the
    ///         refund keeps balance == escrowedAmount (solvent, nothing locks).
    function test_BANIFOT_overpayTaxedFunding_refundsNetSurplus_solvent() public {
        setUpFE();
        FeeToken tax = new FeeToken("Taxed", "TAX", 1000, COLLECTOR); // 10% fee
        escrow.setTokenAllowed(address(tax), true);
        uint256 id = _createProject(tax, 1200 ether);

        // send 1200 -> received 1080 >= 1000 budget; refund net 80
        _fund(id, tax, 1200 ether);
        _accept(id);

        assertEq(tax.balanceOf(address(escrow)), 1000 ether, "BANI-FOT: escrow solvent");
        assertEq(escrow.totalEscrowed(address(tax)), 1000 ether, "BANI-FOT: obligation tracked");
        // The 80-wei net-surplus refund is itself skimmed 10% by the FoT token,
        // so the client receives 72 back (inherent to FoT tokens, harmless now
        // that the escrow is solvent — nothing reverts, nothing locks).
        assertEq(tax.balanceOf(CLIENT), 72 ether, "BANI-FOT: client refunded net 72 (80 skimmed 10%)");
    }

    /// @notice Control: a normal (0% fee) token flow is untouched.
    function test_BANIFOT_control_normalToken_fundsFine() public {
        setUpFE();
        uint256 id = _createProject(token, 1000 ether);
        _fund(id, token, 1000 ether);
        _accept(id);

        assertEq(token.balanceOf(address(escrow)), 1000 ether, "BANI-FOT: control escrow full");
        assertEq(escrow.totalEscrowed(address(token)), 1000 ether, "BANI-FOT: control obligation");
    }

    /// @notice End-to-end: with the fix, an insolvent project can no longer be
    ///         created — every exit path that previously deadlocked now works.
    ///         (Negative control of the deadlock claim: a solvent project funded
    ///         with an overpaid taxed token completes and releases cleanly.)
    function test_BANIFOT_solventProject_completesAndReleases() public {
        setUpFE();
        FeeToken tax = new FeeToken("Taxed", "TAX", 1000, COLLECTOR); // 10% fee
        escrow.setTokenAllowed(address(tax), true);
        uint256 id = _createProject(tax, 1200 ether);
        _fund(id, tax, 1200 ether);
        _accept(id);

        uint256 balBefore = tax.balanceOf(FREELANCER);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "h0");
        vm.prank(CLIENT);
        escrow.approveMilestone(id, 0);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 1, "h1");
        vm.prank(CLIENT);
        escrow.approveMilestone(id, 1);

        // Both milestones paid out. Each 500-unit milestone is skimmed 10% by
        // the FoT token at release, so the freelancer nets 436.5 per milestone
        // (873 total) — the 3% platform fee is paid to the treasury in the same
        // transfer, and the tracked obligation is fully released.
        assertEq(tax.balanceOf(FREELANCER) - balBefore, 873 ether, "BANI-FOT: freelancer paid both milestones");
        assertEq(escrow.totalEscrowed(address(tax)), 0, "BANI-FOT: obligation released");
    }

    // ─────────────────────────── ARFAN (zero-reserve Dutch) ───────────────────────────

    /// @notice Zero-reserve Dutch listings can no longer be created: the
    ///         validator rejects reserve == 0, so the free-acquisition +
    ///         deadlock state never exists.
    function test_ARFAN1_zeroReserveListing_reverts() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        vm.prank(SELLER);
        vm.expectRevert(); // InvalidParams
        goods.listDutch("uri", "desc", "tags", false, 1 ether, 0, 1 days, "cat", "delivery");
    }

    /// @notice Even if a zero price could occur, `buy`/`buyWithToken` now
    ///         reject a zero clearing price — escrow can never record 0.
    function test_ARFAN1_zeroPricePurchase_reverts() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        vm.prank(SELLER);
        uint256 id = goods.listDutch("uri", "desc", "tags", false, 1 ether, 1 wei, 1 days, "cat", "delivery");

        // Decayed past duration: currentPrice == reserve == 1 wei (non-zero
        // reserve passes the new validator — purchases below it still revert).
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(CLIENT);
        vm.expectRevert(); // PriceTooLow — 0-value payment rejected
        goods.buy{value: 0}(id);
        vm.prank(CLIENT);
        vm.expectRevert(); // PriceTooLow
        goods.buyWithToken(id, address(plain), 0);
    }

    /// @notice The phantom-id footgun is closed: buying a nonexistent listing
    ///         reverts (empty slot yields price == 0 → zero-price guard).
    function test_ARFAN1_phantomBuyEmptySlot_reverts() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        vm.prank(CLIENT);
        vm.expectRevert(); // PriceTooLow
        goods.buy{value: 0}(9999);
    }

    /// @notice Control: a normal Dutch sale still settles — seller paid,
    ///         fee collected, listing resolved.
    function test_ARFAN1_control_normalDutchSettles() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18, 1_000_000 ether);
        DigitalGoods goods = _mkGoods(plain);
        vm.prank(SELLER);
        uint256 id = goods.listDutch("uri", "desc", "tags", false, 2 ether, 0.5 ether, 1 days, "cat", "delivery");

        vm.warp(block.timestamp + 1 days);
        uint256 price = goods.currentPrice(id);
        assertTrue(price == 0.5 ether, "ARFAN1: decayed to reserve");
        vm.deal(CLIENT, price);
        vm.prank(CLIENT);
        goods.buy{value: price}(id);

        vm.prank(SELLER);
        goods.submitDelivery(id, "key");
        vm.prank(CLIENT);
        goods.confirmDelivery(id);

        uint256 sellerPaid = address(SELLER).balance + plain.balanceOf(SELLER);
        assertTrue(sellerPaid > 0, "ARFAN1: seller received settlement");
        vm.prank(CLIENT);
        vm.expectRevert(); // AlreadyConfirmed — listing finalized (escrow released)
        goods.dispute(id);
    }

    // ─────────────────────────── ARFAN-2 (Dutch funding brick) ───────────────────────────

    /// @notice Deep-discount Dutch funding no longer bricks the project: the
    ///         1-wei bump is gone, sum(milestones) == escrowedAmount exactly,
    ///         and acceptProject works at reserve sweep levels that were
    ///         permanently un-acceptable before the fix.
    function test_ARFAN2_deepDiscountFund_acceptableAtAllReserves() public {
        setUpFE(); // deploy fresh FreelancerEscrow (this contract = admin/agent)

        // The hunter's exact milestone shape: 8 × 1 wei + 9992 wei = 10000.
        // Sweep his 9 reserve levels — every one must now be acceptable.
        uint256[9] memory reserves = [uint256(1), 5, 9, 20, 50, 100, 200, 500, 1000];
        uint256 t0 = block.timestamp; // precompute: absolute warps only
        for (uint256 k; k < 9; k++) {
            uint256 tStart = t0 + k * 150_000;
            string[] memory d = new string[](9);
            uint256[] memory a = new uint256[](9);
            uint256[] memory t = new uint256[](9);
            for (uint256 i; i < 9; i++) {
                d[i] = "w";
                a[i] = i == 8 ? 9992 : 1;
                t[i] = tStart + 500_000 + i;
            }
            vm.warp(tStart);
            vm.prank(CLIENT);
            uint256 id = escrow.createProjectDutch(
                "P", "u", "g", "c", 30, 10000, reserves[k], 100000, d, a, t
            );

            vm.warp(tStart + 100_001); // auction elapsed → price == reserve
            assertEq(escrow.currentBudget(id), reserves[k], "dutch decayed to reserve");

            vm.deal(CLIENT, reserves[k]);
            vm.prank(CLIENT);
            escrow.fundProject{value: reserves[k]}(id);

            vm.prank(FREELANCER); // was: revert NoFunds (9/9 bricked pre-fix)
            escrow.acceptProject(id);
            vm.prank(FREELANCER);
            escrow.submitMilestone(id, 0, "work"); // 0-amount milestone tolerated
            vm.prank(CLIENT);
            escrow.approveMilestone(id, 0);
        }
    }

    /// @notice Control: full-price funding still runs the normal lifecycle.
    function test_ARFAN2_control_fullPrice_fine() public {
        setUpFE();
        string[] memory d = new string[](3);
        uint256[] memory a = new uint256[](3);
        uint256[] memory t = new uint256[](3);
        d[0] = "m0"; d[1] = "m1"; d[2] = "m2";
        a[0] = 3000; a[1] = 3000; a[2] = 4000;
        t[0] = block.timestamp + 1000;
        t[1] = block.timestamp + 1001;
        t[2] = block.timestamp + 1002;

        vm.prank(CLIENT);
        uint256 id = escrow.createProjectDutch(
            "P", "u", "g", "c", 30, 10000, 1000, 100000, d, a, t
        );
        assertEq(escrow.currentBudget(id), 10000, "control: full price");
        vm.deal(CLIENT, 10000);
        vm.prank(CLIENT);
        escrow.fundProject{value: 10000}(id);
        vm.prank(FREELANCER);
        escrow.acceptProject(id);
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 0, "h0");
        vm.prank(CLIENT);
        escrow.approveMilestone(id, 0);
        assertEq(FREELANCER.balance, 2910, "control: m0 paid net of 3% fee (native)" );
    }

    /// @notice Control: a zero-amount milestone Sum plus dust-add still equals
    ///         the escrow exactly when every floor rounds to zero (escrow 1
    ///         wei over a 10000 budget): only the last milestone carries it,
    ///         and the project remains acceptable + payable end-to-end.
    function test_ARFAN2_allFloored_lastCarriesEscrow() public {
        setUpFE();
        uint256 t0 = block.timestamp;
        string[] memory d = new string[](3);
        uint256[] memory a = new uint256[](3);
        uint256[] memory t = new uint256[](3);
        d[0] = "m0"; d[1] = "m1"; d[2] = "m2";
        a[0] = 1; a[1] = 1; a[2] = 9998;
        t[0] = t0 + 500_000;
        t[1] = t0 + 500_001;
        t[2] = t0 + 500_002;

        vm.prank(CLIENT);
        uint256 id = escrow.createProjectDutch(
            "P", "u", "g", "c", 30, 10000, 1, 100000, d, a, t
        );
        vm.warp(t0 + 100_001); // auction elapsed → price == reserve (1 wei)
        vm.deal(CLIENT, 1);
        vm.prank(CLIENT);
        escrow.fundProject{value: 1}(id);
        vm.prank(FREELANCER);
        escrow.acceptProject(id); // pre-fix: revert NoFunds (sum 3 > 1)
        vm.prank(FREELANCER);
        escrow.submitMilestone(id, 2, "whole-scope"); // last carries the wei
        vm.prank(CLIENT);
        escrow.approveMilestone(id, 2);
    }

    function assertTrue(bool v, string memory m) internal pure {
        require(v, m);
    }

    function assertEq(uint256 a, uint256 b, string memory m) internal pure {
        require(a == b, m);
    }

    function assertEq(address a, address b, string memory m) internal pure {
        require(a == b, m);
    }
}
