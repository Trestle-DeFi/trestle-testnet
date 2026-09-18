// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Testnet ERC-4626 vault. `harvest` transfers underlying assets into the
/// vault WITHOUT minting new shares, so each share's asset value increases —
/// simulating organic DeFi yield accrual (e.g. Aave supply APY on Polygon).
///
/// H-1 note: inherits OpenZeppelin v5.6.1 `ERC4626`, whose `totalAssets() + 1`
/// virtual-asset accounting already makes first-depositor donation attacks
/// unprofitable by default. No `_decimalsOffset()` override is added on purpose
/// (a non-zero offset would change share math and break exact payout tests);
/// a production vault should tune the offset per the OZ ERC-4626 guidance.
contract MockYieldVault is ERC4626, Ownable, ReentrancyGuard {
    constructor(IERC20 _asset, string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
        ERC4626(_asset)
        Ownable(msg.sender)
    {}

    function harvest(uint256 _amount) external onlyOwner nonReentrant {
        if (_amount == 0) return;
        IERC20(asset()).transferFrom(msg.sender, address(this), _amount);
    }
}