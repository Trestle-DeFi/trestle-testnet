// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {FreelancerEscrow} from "../src/FreelancerEscrow.sol";
import {DigitalGoods} from "../src/DigitalGoods.sol";
import {DigitalRWA} from "../src/DigitalRWA.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {MockV3Aggregator} from "../src/mocks/MockV3Aggregator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal cheatcode interface (forge-std is not installed in this repo).
interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function deal(address, uint256) external;
    function label(address, string calldata) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
}

/// @title Foundry audit PoC suite — mirrors Addendum 1 (A-*) and Addendum 2 (E-*) findings.
/// @notice Self-contained: no forge-std dependency; minimal asserts implemented locally.
contract AuditPoCTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant CLIENT_A = address(0xA11CE);
    address constant CLIENT_B = address(0xB0B02);
    address constant FREELANCER = address(0xF1391);
    address constant TREASURY = address(0x7E2A5);
    address constant BUYBACK = address(0x8ACB);
    address constant YIELD = address(0xC1C10);

    receive() external payable {}

    // ─── local assert helpers (no forge-std) ───────────────────────────
    function assertTrue(bool v, string memory m) internal pure {
        require(v, m);
    }

    function assertEq(uint256 a, uint256 b, string memory m) internal pure {
        require(a == b, m);
    }

    function _milestones(uint256 budget)
        internal
        view
        returns (string[] memory, uint256[] memory, uint256[] memory)
    {
        string[] memory descs = new string[](2);
        descs[0] = "m1";
        descs[1] = "m2";
        uint256[] memory amts = new uint256[](2);
        amts[0] = budget / 2;
        amts[1] = budget - budget / 2;
        uint256[] memory dls = new uint256[](2);
        dls[0] = block.timestamp + 10 days;
        dls[1] = block.timestamp + 20 days;
        return (descs, amts, dls);
    }

    // ─── E-1 (HIGH) FIXED: overpaying can no longer drain the escrow ───
    function test_fundProjectWithToken_overpayIsSafe() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        escrow.setTokenAllowed(address(token), true);
        // yieldVault intentionally NOT set -> escrow stays in the contract

        token.mint(CLIENT_A, 1000 ether);
        uint256 bA = 100 ether;
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(bA);
        vm.prank(CLIENT_A);
        escrow.createProjectFixed("A", "u", "g", "c", 30, bA, d, a, t);
        vm.prank(CLIENT_A);
        token.approve(address(escrow), bA);
        vm.prank(CLIENT_A);
        escrow.fundProjectWithToken(1, address(token), bA);
        assertEq(token.balanceOf(address(escrow)), bA, "escrow holds A's 100");

        // Attacker: 10 T project, approves only 10 T, but claims 90 T in _amount
        token.mint(CLIENT_B, 1000 ether);
        uint256 bB = 10 ether;
        (d, a, t) = _milestones(bB);
        vm.prank(CLIENT_B);
        escrow.createProjectFixed("B", "u", "g", "c", 30, bB, d, a, t);
        vm.prank(CLIENT_B);
        // With the E-1 fix the contract pulls the FULL claimed _amount, so the
        // allowance must cover it (90) — not just the budget (10).
        token.approve(address(escrow), 90 ether);

        vm.prank(CLIENT_B);
        escrow.fundProjectWithToken(2, address(token), 90 ether);

        // FIXED: full _amount pulled, excess refunded from the pull itself —
        // escrow ends with exactly A(100) + B(10); attacker pays net -10.
        assertEq(token.balanceOf(address(escrow)), 110 ether, "escrow intact");
        assertEq(token.balanceOf(CLIENT_B), 990 ether, "no drain: net -10 only");

        // Victim project A pays out normally
        vm.prank(FREELANCER);
        escrow.acceptProject(1);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 0, "hash");
        vm.prank(CLIENT_A);
        escrow.approveMilestone(1, 0); // reverted before the fix
        assertEq(token.balanceOf(FREELANCER), 48.5 ether, "freelancer paid 97% of m0");
    }

    // ─── E-2 (MEDIUM) FIXED: yield flag / vault swap can't brick payouts ─
    function test_yieldDisabledAndVaultSwapSafe() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        MockYieldVault vault1 = new MockYieldVault(IERC20(address(token)), "V1", "V1");
        MockYieldVault vault2 = new MockYieldVault(IERC20(address(token)), "V2", "V2");
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        escrow.setTokenAllowed(address(token), true);
        escrow.setYieldVault(address(vault1));

        token.mint(CLIENT_A, 1000 ether);
        uint256 budget = 100 ether;
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(budget);
        vm.prank(CLIENT_A);
        escrow.createProjectFixed("P", "u", "g", "c", 30, budget, d, a, t);
        vm.prank(CLIENT_A);
        token.approve(address(escrow), budget);
        vm.prank(CLIENT_A);
        escrow.fundProjectWithToken(1, address(token), budget);

        assertEq(token.balanceOf(address(escrow)), 0, "escrow deposited to vault");
        assertEq(escrow.projectsWithShares(), 1, "migration lock engaged");

        vm.prank(FREELANCER);
        escrow.acceptProject(1);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 0, "hash");

        // (a) FIXED: disabling yield AFTER a deposit no longer bricks payouts —
        //     outstanding shares stay redeemable.
        escrow.setYieldEnabled(false);
        vm.prank(CLIENT_A);
        escrow.approveMilestone(1, 0);
        assertTrue(escrow.projectShares(1) > 0, "shares outstanding after m0");

        // (b) FIXED: swapping the vault while shares are outstanding is blocked
        vm.expectRevert(); // VaultMigrationBlocked
        escrow.setYieldVault(address(vault2));

        // (c) after the project settles (shares == 0), migration is allowed again
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 1, "hash");
        vm.prank(CLIENT_A);
        escrow.approveMilestone(1, 1);
        assertEq(escrow.projectShares(1), 0, "all shares redeemed");
        assertEq(escrow.projectsWithShares(), 0, "lock released");
        escrow.setYieldVault(address(vault2)); // now allowed
    }

    // ─── E-3/E-4 FIXED: arbitration exists + buyer refunds are 100% ─────
    function test_disputeArbitrationAndFeeRefund() public {
        DigitalGoods goods = new DigitalGoods(TREASURY);
        uint256 price = 1 ether;
        vm.startPrank(FREELANCER); // seller
        goods.listFixed("uri1", "desc", "tags", false, price, "cat", "delivery"); // id 1
        goods.listFixed("uri2", "desc", "tags", false, price, "cat", "delivery"); // id 2
        vm.stopPrank();

        vm.deal(CLIENT_A, 10 ether);
        vm.deal(CLIENT_B, 10 ether);
        vm.warp(1000);
        vm.prank(CLIENT_A);
        goods.buy{value: price}(1);
        vm.prank(CLIENT_B);
        goods.buy{value: price}(2);

        // E-4 FIXED: no fee leaves the contract at buy time
        assertEq(TREASURY.balance, 0, "no fee at buy time");

        // Listing 1: owner arbitrates FOR the buyer -> FULL refund incl. fee (E-4)
        vm.prank(CLIENT_A);
        goods.dispute(1);
        goods.resolveDispute(1, true); // owner = this test contract
        assertEq(CLIENT_A.balance, 10 ether, "buyer fully refunded (E-4)");
        assertEq(TREASURY.balance, 0, "fee refunded with the sale");

        // Listing 2: owner arbitrates FOR the seller -> fee 3% on release (E-3)
        vm.prank(CLIENT_B);
        goods.dispute(2);
        goods.resolveDispute(2, false);
        assertEq(TREASURY.balance, 0.03 ether, "fee collected on seller release");
        assertEq(FREELANCER.balance, 0.97 ether, "seller paid 97%");
    }

    // ─── H-3 (MEDIUM) FIXED: distribute() fails early without a vault ───
    function test_feeDistributor_distributeWithoutVaultReverts() public {
        FeeDistributor fd = new FeeDistributor(TREASURY, BUYBACK);
        vm.deal(address(fd), 10 ether);
        vm.expectRevert(); // ZeroAddress: the 40% yield share can't go to address(0)
        fd.distribute(address(0));
    }

    // ─── M-1 (MEDIUM) FIXED: whitelist token list is capped ────────────
    function test_whitelistTokenListCapped() public {
        MockV3Aggregator feed = new MockV3Aggregator(8, 100000000);
        DigitalRWA rwa = new DigitalRWA(
            "R", "R", "uri", 1_000_000 ether, address(this), address(0), 0, address(feed)
        );
        for (uint256 i = 1; i <= 10; i++) {
            MockERC20 t = new MockERC20("W", "W", 18, 0);
            rwa.setWhitelistToken(address(t), 1 ether);
        }
        MockERC20 extra = new MockERC20("X", "X", 18, 0);
        vm.expectRevert(); // TooManyWhitelistTokens (M-1 fix)
        rwa.setWhitelistToken(address(extra), 1 ether);
    }

    // ─── E-6 (INFO) FIXED: clients cannot self-accept their project ────
    function test_selfAcceptBlocked() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        escrow.setTokenAllowed(address(token), true);
        token.mint(CLIENT_A, 1000 ether);
        uint256 bA = 100 ether;
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(bA);
        vm.prank(CLIENT_A);
        escrow.createProjectFixed("A", "u", "g", "c", 30, bA, d, a, t);
        vm.prank(CLIENT_A);
        token.approve(address(escrow), bA);
        vm.prank(CLIENT_A);
        escrow.fundProjectWithToken(1, address(token), bA);
        vm.prank(CLIENT_A);
        vm.expectRevert(); // SelfAccept (E-6 fix)
        escrow.acceptProject(1);
    }

    // ─── Migration runbook (immutable + migrate decision) ─────────────
    function test_migrateEscrow_sweepsIdleOnly() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        FreelancerEscrow escrowV2 = new FreelancerEscrow(TREASURY);
        escrow.setTokenAllowed(address(token), true);

        token.mint(CLIENT_A, 1000 ether);
        uint256 bA = 100 ether;
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(bA);
        vm.prank(CLIENT_A);
        escrow.createProjectFixed("A", "u", "g", "c", 30, bA, d, a, t);
        vm.prank(CLIENT_A);
        token.approve(address(escrow), bA);
        vm.prank(CLIENT_A);
        escrow.fundProjectWithToken(1, address(token), bA);
        assertEq(escrow.totalEscrowed(address(token)), bA, "obligation tracked");

        // Runbook enforced in code: no migration while obligations exist
        vm.expectRevert(); // UnsettledObligations
        escrow.migrateEscrow(payable(address(escrowV2)), address(token));

        // Runbook step 2: settle the project via the normal paths
        vm.prank(FREELANCER);
        escrow.acceptProject(1);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 0, "h1");
        vm.prank(CLIENT_A);
        escrow.approveMilestone(1, 0);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 1, "h2");
        vm.prank(CLIENT_A);
        escrow.approveMilestone(1, 1);
        assertEq(escrow.totalEscrowed(address(token)), 0, "settled");
        assertEq(token.balanceOf(address(escrow)), 0, "fully paid out");

        // Idle dust arrives after settlement
        token.transfer(address(escrow), 5 ether);
        assertEq(escrow.idleBalance(address(token)), 5 ether, "idle tracked");

        // Runbook step 3: sweep the idle surplus to v2
        escrow.migrateEscrow(payable(address(escrowV2)), address(token));
        assertEq(token.balanceOf(address(escrowV2)), 5 ether, "idle migrated");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow empty");
    }

    function test_migrateEscrow_native() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        EthReceiver target = new EthReceiver();

        vm.deal(CLIENT_A, 100 ether);
        uint256 bA = 100 ether;
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(bA);
        vm.prank(CLIENT_A);
        escrow.createProjectFixed("A", "u", "g", "c", 30, bA, d, a, t);
        vm.prank(CLIENT_A);
        escrow.fundProject{value: bA}(1);
        assertEq(escrow.totalEscrowed(address(0)), bA, "native obligation tracked");

        // Runbook: cancel refunds the client -> obligation released
        vm.prank(CLIENT_A);
        escrow.cancelProject(1);
        assertEq(escrow.totalEscrowed(address(0)), 0, "settled");
        assertEq(address(escrow).balance, 0, "refunded in full");

        // Residual native dust migrates cleanly
        vm.deal(address(escrow), 2 ether);
        assertEq(escrow.idleBalance(address(0)), 2 ether, "idle native tracked");
        escrow.migrateEscrow(payable(address(target)), address(0));
        assertEq(address(target).balance, 2 ether, "native migrated");
    }

    // ─── sanity: FeeDistributor 40/40/20 native split ──────────────────
    function test_feeDistributor_splits_40_40_20() public {
        FeeDistributor fd = new FeeDistributor(TREASURY, BUYBACK);
        fd.setYieldVault(YIELD);
        vm.deal(address(fd), 10 ether);
        fd.distribute(address(0)); // native
        assertEq(YIELD.balance, 4 ether, "yield share");
        assertEq(TREASURY.balance, 4 ether, "treasury share");
        assertEq(BUYBACK.balance, 2 ether, "buyback share");
    }

    // ─── Whitelist flag with 24h expiry (item 9) ───────────────────────
    function test_whitelistFlagExpiresAfter24h() public {
        // Deploy fresh RWA with price feed
        MockV3Aggregator feed = new MockV3Aggregator(8, 100000000000); // $100
        MockERC20 govTok = new MockERC20("Gov", "GOV", 18, 1_000_000 ether);
        DigitalRWA rwa = new DigitalRWA(
            "Trestle RWA", "tRWA", "ipfs://meta",
            1_000_000 ether, address(this),
            address(govTok), 100 ether,
            address(feed)
        );

        // Grant ALLOWLIST_MANAGER to deployer
        bytes32 ALLOWLIST_MANAGER = keccak256("ALLOWLIST_MANAGER");
        rwa.grantRole(ALLOWLIST_MANAGER, address(this));

        // User has no GOV tokens — not whitelisted via balance
        assertTrue(!rwa.isWhitelisted(CLIENT_A), "not whitelisted initially");

        // Bot sets whitelist flag — now whitelisted
        rwa.setWhitelistFlag(CLIENT_A);
        assertTrue(rwa.isWhitelisted(CLIENT_A), "whitelisted after flag");

        // Flag expires after 24h
        vm.warp(block.timestamp + 24 hours + 1);
        assertTrue(!rwa.isWhitelisted(CLIENT_A), "flag expired after 24h");

        // Bot can renew the flag
        rwa.setWhitelistFlag(CLIENT_A);
        assertTrue(rwa.isWhitelisted(CLIENT_A), "flag renewed");
    }

    function test_whitelistFlagWithTokenBalance() public {
        MockV3Aggregator feed = new MockV3Aggregator(8, 100000000000);
        MockERC20 govTok = new MockERC20("Gov", "GOV", 18, 1_000_000 ether);
        DigitalRWA rwa = new DigitalRWA(
            "Trestle RWA", "tRWA", "ipfs://meta",
            1_000_000 ether, address(this),
            address(govTok), 100 ether,
            address(feed)
        );

        bytes32 ALLOWLIST_MANAGER = keccak256("ALLOWLIST_MANAGER");
        rwa.grantRole(ALLOWLIST_MANAGER, address(this));

        // Give user GOV tokens — whitelisted via balance
        govTok.transfer(CLIENT_A, 100 ether);
        assertTrue(rwa.isWhitelisted(CLIENT_A), "whitelisted via balance");

        // Flag expires — still whitelisted via balance
        vm.warp(block.timestamp + 24 hours + 1);
        assertTrue(rwa.isWhitelisted(CLIENT_A), "still whitelisted via balance");

        // Revoke GOV tokens — no longer whitelisted
        vm.prank(CLIENT_A);
        govTok.transfer(address(this), 100 ether);
        assertTrue(!rwa.isWhitelisted(CLIENT_A), "no longer whitelisted");
    }

    function test_whitelistFlagRevertsOnZeroAddress() public {
        MockV3Aggregator feed = new MockV3Aggregator(8, 100000000000);
        MockERC20 govTok = new MockERC20("Gov", "GOV", 18, 1_000_000 ether);
        DigitalRWA rwa = new DigitalRWA(
            "Trestle RWA", "tRWA", "ipfs://meta",
            1_000_000 ether, address(this),
            address(govTok), 100 ether,
            address(feed)
        );

        bytes32 ALLOWLIST_MANAGER = keccak256("ALLOWLIST_MANAGER");
        rwa.grantRole(ALLOWLIST_MANAGER, address(this));

        vm.expectRevert();
        rwa.setWhitelistFlag(address(0));
    }

    /// @notice A-7: setFeeDistributor rejects zero address.
    function test_setFeeDistributor_zeroAddress_reverts() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        vm.expectRevert();
        escrow.setFeeDistributor(address(0));
    }
}

/// @dev Migration target that can receive native ETH.
contract EthReceiver {
    receive() external payable {}
}

