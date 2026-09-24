// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

/// @notice Minimal interface platform contracts use to notify UserProfile.
///         Implemented by UserProfile; platform contracts hold an optional
///         address and no-op when unset (address(0)).
interface IUserProfile {
    function markInteracted(address user) external;
    function markDealComplete(address a, address b) external;
}
