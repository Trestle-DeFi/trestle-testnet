// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockGovernanceToken is ERC20, Ownable {
    uint8 private _dec;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        _dec = _decimals;
        _mint(msg.sender, _initialSupply);
    }

    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    /// @notice Burn tokens from any address. A-1 fix: restricted to the owner —
    ///         previously ANY address could burn anyone's balance, griefing
    ///         token-gated features (UserProfile reviews, DigitalRWA whitelist).
    function burn(address _from, uint256 _amount) external onlyOwner {
        _burn(_from, _amount);
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }
}
