// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import {FreelancerEscrow} from "../src/FreelancerEscrow.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

/// @title TRESTLE-GIG-DEADLINE-20261015 regression suite.
/// @notice Gig milestone deadlines were unbounded: `createGig`/`updateGig`
///         have no duration field and pass `_durationDays == 0`, so the
///         relative cap in `_validateMilestones` never fired. The fix replaces
///         the unbounded case with an absolute `MAX_MILESTONE_HORIZON` (365d)
///         bound. Self-contained: no forge-std.
contract GigDeadlineTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant FREELANCER = address(0xF1391);
    address constant TREASURY = address(0x7E2A5);

    function assertTrue(bool v, string memory m) internal pure { require(v, m); }
    function assertEq(uint256 a, uint256 b, string memory m) internal pure { require(a == b, m); }

    function _ms(uint256 d0, uint256 d1)
        internal
        pure
        returns (string[] memory, uint256[] memory, uint256[] memory)
    {
        string[] memory descs = new string[](2);
        descs[0] = "m0"; descs[1] = "m1";
        uint256[] memory amts = new uint256[](2);
        amts[0] = 500 ether; amts[1] = 500 ether;
        uint256[] memory dls = new uint256[](2);
        dls[0] = d0; dls[1] = d1;
        return (descs, amts, dls);
    }

    function _createGig(FreelancerEscrow escrow, uint256 d0, uint256 d1) internal returns (uint256) {
        (string[] memory descs, uint256[] memory amts, uint256[] memory dls) = _ms(d0, d1);
        vm.prank(FREELANCER);
        return escrow.createGig("G", "u", "gh", "pf", "cat", 500 ether, 1000 ether, descs, amts, dls);
    }

    // ─── 1. In-horizon gig deadlines still work ───────────────────────────
    function test_GigDeadline_withinHorizonAccepted() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        uint256 id = _createGig(escrow, block.timestamp + 10 days, block.timestamp + 20 days);
        assertEq(id, 1, "gig created");
        assertEq(escrow.getGigMilestoneCount(id), 2, "milestones stored");
        assertEq(escrow.gigCount(), 1, "gigCount bumped");
    }

    // ─── 2. Deadline exactly at the horizon boundary is allowed ───────────
    function test_GigDeadline_exactHorizonAllowed() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        uint256 horizon = escrow.MAX_MILESTONE_HORIZON();
        uint256 id = _createGig(escrow, block.timestamp + horizon - 1 days, block.timestamp + horizon);
        assertEq(escrow.getGigMilestoneCount(id), 2, "boundary gig accepted");
    }

    // ─── 3. Beyond the horizon reverts (the exploit) ──────────────────────
    function test_GigDeadline_beyondHorizonRejected() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        (string[] memory descs, uint256[] memory amts, uint256[] memory dls) =
            _ms(block.timestamp + 366 days, block.timestamp + 400 days);
        vm.prank(FREELANCER);
        vm.expectRevert(FreelancerEscrow.PastDeadline.selector);
        escrow.createGig("G", "u", "gh", "pf", "cat", 500 ether, 1000 ether, descs, amts, dls);
    }

    // ─── 4. updateGig is bounded too (same exploit via the update path) ───
    function test_GigUpdate_beyondHorizonRejected() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        uint256 id = _createGig(escrow, block.timestamp + 10 days, block.timestamp + 20 days);

        (string[] memory descs, uint256[] memory amts, uint256[] memory dls) =
            _ms(block.timestamp + 400 days, block.timestamp + 800 days);
        vm.prank(FREELANCER);
        vm.expectRevert(FreelancerEscrow.PastDeadline.selector);
        escrow.updateGig(id, "G2", "u2", 1000 ether, descs, amts, dls);
    }

    // ─── 5. Control: project relative duration cap is unchanged ───────────
    function test_ProjectRelativeDurationStillEnforced() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        (string[] memory descs, uint256[] memory amts, uint256[] memory dls) =
            _ms(block.timestamp + 10 days, block.timestamp + 60 days);
        vm.prank(FREELANCER);
        vm.expectRevert(FreelancerEscrow.PastDeadline.selector);
        escrow.createProjectFixed("P", "u", "g", "c", 30, 1000 ether, descs, amts, dls);
    }

    // ─── 6. Control: project with 0 duration now bounded by the horizon ───
    function test_ProjectZeroDurationNowBounded() public {
        FreelancerEscrow escrow = new FreelancerEscrow(TREASURY);
        (string[] memory descs, uint256[] memory amts, uint256[] memory dls) =
            _ms(block.timestamp + 10 days, block.timestamp + 500 days);
        vm.prank(FREELANCER);
        vm.expectRevert(FreelancerEscrow.PastDeadline.selector);
        escrow.createProjectFixed("P", "u", "g", "c", 0, 1000 ether, descs, amts, dls);
    }
}
