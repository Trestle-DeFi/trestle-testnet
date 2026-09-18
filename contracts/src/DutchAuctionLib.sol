// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

library DutchAuctionLib {
    struct Params {
        uint256 startPrice;
        uint256 reservePrice;
        uint256 duration;
        uint256 startedAt;
    }

    error InvalidParams();

    function validate(uint256 _startPrice, uint256 _reservePrice, uint256 _duration) internal pure {
        if (_startPrice <= _reservePrice || _duration == 0) revert InvalidParams();
    }

    /// @notice Current Dutch-auction price.
    /// @dev L-3: when `startedAt == 0` (auction never started / uninitialized
    ///      Params) the `startPrice` is returned. Correct for the current flows —
    ///      `listDutch`/`createProjectDutch` always set `startedAt` at creation —
    ///      but treat an unstarted auction as "at start price" if this library is
    ///      reused in a different context.
    function currentPrice(Params memory _auction) internal view returns (uint256) {
        if (_auction.startedAt == 0) return _auction.startPrice;
        uint256 elapsed = block.timestamp - _auction.startedAt;
        if (elapsed >= _auction.duration) return _auction.reservePrice;
        uint256 drop = ((_auction.startPrice - _auction.reservePrice) * elapsed) / _auction.duration;
        return _auction.startPrice - drop;
    }
}
