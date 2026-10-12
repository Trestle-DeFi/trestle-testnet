// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import {FreelancerEscrow} from "../src/FreelancerEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
}

/// @title F-T1 (TRESTLE-FT1-COARSE-20261009) regression suite.
/// @notice Coarse-share vault donation must no longer brick milestones or
///         misroute surplus to the treasury. Self-contained: no forge-std.
contract FT1FixTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant CLIENT = address(0xA11CE);
    address constant FREELANCER = address(0xF1391);
    address constant TREASURY = address(0x7E2A5);
    address constant DONOR = address(0xD0);
    address constant VAULT_OWNER = address(0xFEEDE);

    function assertTrue(bool v, string memory m) internal pure { require(v, m); }
    function assertEq(uint256 a, uint256 b, string memory m) internal pure { require(a == b, m); }

    function _milestones(uint256 m0, uint256 m1)
        internal
        view
        returns (string[] memory, uint256[] memory, uint256[] memory)
    {
        string[] memory d = new string[](2);
        d[0] = "m0"; d[1] = "m1";
        uint256[] memory a = new uint256[](2);
        a[0] = m0; a[1] = m1;
        uint256[] memory t = new uint256[](2);
        t[0] = block.timestamp + 10 days; t[1] = block.timestamp + 20 days;
        return (d, a, t);
    }

    function _setup(MockERC20 token, MockYieldVault vault, FreelancerEscrow escrow) internal {
        escrow.setTokenAllowed(address(token), true);
        escrow.setYieldVault(address(vault));
    }

    // ─── 1. Deposit-side guard: donation-inflated coarse grant reverts ───
    function test_FT1_donationAttackBlockedAtDeposit() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        MockYieldVault vault = new MockYieldVault(IERC20(address(token)), "V", "V");
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        _setup(token, vault, escrow);

        // Attacker donates 1500e18 (0 shares) — the F-T1 PoC precondition.
        token.mint(DONOR, 1500 ether);
        vm.prank(DONOR);
        token.transfer(address(vault), 1500 ether);

        // Funding would previously mint 1 coarse share and brick m1.
        token.mint(CLIENT, 2000 ether);
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(1000 ether, 1000 ether);
        vm.prank(CLIENT);
        escrow.createProjectFixed("P", "u", "g", "c", 30, 2000 ether, d, a, t);
        vm.prank(CLIENT);
        token.approve(address(escrow), 2000 ether);
        vm.prank(CLIENT);
        vm.expectRevert(FreelancerEscrow.CoarseShares.selector);
        escrow.fundProjectWithToken(1, address(token), 2000 ether);
    }

    // ─── 2. Negative control: clean vault pays both milestones in full ───
    function test_FT1_negativeControl_fullLifecyclePays() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        MockYieldVault vault = new MockYieldVault(IERC20(address(token)), "V", "V");
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        _setup(token, vault, escrow);

        token.mint(CLIENT, 2000 ether);
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(1000 ether, 1000 ether);
        vm.prank(CLIENT);
        escrow.createProjectFixed("P", "u", "g", "c", 30, 2000 ether, d, a, t);
        vm.prank(CLIENT);
        token.approve(address(escrow), 2000 ether);
        vm.prank(CLIENT);
        escrow.fundProjectWithToken(1, address(token), 2000 ether);
        assertEq(escrow.projectShares(1), 2000 ether, "1:1 shares, no donation");

        vm.prank(FREELANCER);
        escrow.acceptProject(1);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 0, "h0");
        vm.prank(CLIENT);
        escrow.approveMilestone(1, 0);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 1, "h1");
        vm.prank(CLIENT);
        escrow.approveMilestone(1, 1);

        assertEq(token.balanceOf(FREELANCER), 1940 ether, "freelancer 97% of 2000");
        assertEq(token.balanceOf(TREASURY), 60 ether, "treasury 3% fee only");
        assertEq(token.balanceOf(address(escrow)), 0, "nothing stranded");
        assertEq(escrow.projectShares(1), 0, "shares fully redeemed");
    }

    // ─── 3. Legitimate organic yield must still pass the new rate guard ───
    function test_FT1_organicYieldStillDepositsAndPays() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        MockYieldVault vault = new MockYieldVault(IERC20(address(token)), "V", "V");
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        _setup(token, vault, escrow);

        // Establish real vault shareholders, then accrue +200% "organic" yield
        // via harvest (assets in, no new shares) — 3x appreciation. The new
        // rate guard must still accept this deposit (1/3 >> 1/1000).
        token.mint(VAULT_OWNER, 1000 ether);
        vm.prank(VAULT_OWNER);
        token.approve(address(vault), 1000 ether);
        vm.prank(VAULT_OWNER);
        vault.deposit(1000 ether, VAULT_OWNER);
        token.mint(address(this), 2000 ether);
        token.approve(address(vault), 2000 ether);
        vault.harvest(2000 ether);
        assertEq(vault.totalAssets(), 3000 ether, "3x appreciation");

        token.mint(CLIENT, 2000 ether);
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(1000 ether, 1000 ether);
        vm.prank(CLIENT);
        escrow.createProjectFixed("P", "u", "g", "c", 30, 2000 ether, d, a, t);
        vm.prank(CLIENT);
        token.approve(address(escrow), 2000 ether);
        vm.prank(CLIENT);
        escrow.fundProjectWithToken(1, address(token), 2000 ether); // must not revert
        assertTrue(escrow.projectShares(1) > 0, "shares granted");

        vm.prank(FREELANCER);
        escrow.acceptProject(1);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 0, "h0");
        vm.prank(CLIENT);
        escrow.approveMilestone(1, 0);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 1, "h1");
        vm.prank(CLIENT);
        escrow.approveMilestone(1, 1);

        // OZ ERC4626 redeem floors in the vault's favor, so principal can fall
        // a few wei short across two redemptions (E-7 shortfall behavior).
        assertTrue(
            token.balanceOf(FREELANCER) >= 1939 ether && token.balanceOf(FREELANCER) <= 1940 ether,
            "principal paid in full (+/- dust)"
        );
        assertEq(token.balanceOf(address(escrow)), 0, "nothing stranded");
        assertEq(escrow.projectShares(1), 0, "all shares consumed");
    }

    // ─── 4. A-2 bumped redemption: surplus is held, NOT sent to treasury ───
    function test_FT1_dustBumpSurplusHeldInContract() public {
        MockERC20 token = new MockERC20("T", "T", 18, 1_000_000 ether);
        MockYieldVault vault = new MockYieldVault(IERC20(address(token)), "V", "V");
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        _setup(token, vault, escrow);

        // Engineer a coarse-but-LEGAL position: 999 wei donation makes the
        // deposit grant exactly assets/1000 shares — at (not below) the
        // MIN_SHARE_RATE boundary, so the guard must allow it.
        token.mint(DONOR, 999);
        vm.prank(DONOR);
        token.transfer(address(vault), 999);

        token.mint(CLIENT, 2000 ether);
        (string[] memory d, uint256[] memory a, uint256[] memory t) = _milestones(999, 2000 ether - 999);
        vm.prank(CLIENT);
        escrow.createProjectFixed("P", "u", "g", "c", 30, 2000 ether, d, a, t);
        vm.prank(CLIENT);
        token.approve(address(escrow), 2000 ether);
        vm.prank(CLIENT);
        escrow.fundProjectWithToken(1, address(token), 2000 ether);
        assertEq(escrow.projectShares(1), 2000 ether / 1000, "assets/1000 shares");

        // m0 = 999 wei dust => sharesOut = 0 => A-2 bump to 1 share.
        vm.prank(FREELANCER);
        escrow.acceptProject(1);
        vm.prank(FREELANCER);
        escrow.submitMilestone(1, 0, "h0");
        vm.prank(CLIENT);
        escrow.approveMilestone(1, 0);

        uint256 fee = uint256(999) * 300 / 10000; // 29 wei
        assertEq(token.balanceOf(FREELANCER), 999 - fee, "freelancer gets principal net (970)");
        // THE FIX: bumped redemption redeems 1000 wei against a 999 wei
        // principal — the 1 wei surplus must stay in the escrow, not be
        // booked as treasury yield (pre-fix treasury got 30 wei).
        assertEq(token.balanceOf(TREASURY), fee, "treasury gets FEE ONLY (29 wei)");
        assertEq(token.balanceOf(address(escrow)), 1000 - 999, "surplus held for remaining escrow");
    }
}
