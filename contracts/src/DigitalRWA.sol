// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/AggregatorV3Interface.sol";

contract DigitalRWA is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ALLOWLIST_MANAGER = keccak256("ALLOWLIST_MANAGER");

    struct AssetInfo {
        string name;
        string description;
        string tokenType;
        string jurisdiction;
        string issuer;
        string riskLevel;
        uint256 lockupDuration;
        uint256 expectedReturnBps;
        string underlyingAsset;
        uint256 redemptionDate;
        uint256 redemptionPrice;
    }

    string public metadataURI;
    uint256 public immutable cap;
    AssetInfo public assetInfo;
    bool public assetInfoSet;

    IERC20 public govToken;
    uint256 public minGovBalance;
    mapping(address => uint256) public whitelistTokens;
    address[] public whitelistTokenList;
    AggregatorV3Interface public immutable priceFeed;
    uint256 public currentPrice;
    uint256 public lastPriceUpdate;
    uint256 public constant STALE_PRICE_THRESHOLD = 3600;
    /// @dev M-1 fix: `isWhitelisted()` loops over this list with an external
    ///      `balanceOf()` call per token and runs on EVERY transfer — cap the
    ///      list length to bound the gas cost.
    uint256 public constant MAX_WHITELIST_TOKENS = 10;
    /// @dev Joop reply (item 7): max accepted relative price move per sync, in
    ///      percent — blunts a compromised/manipulated feed. Admin
    ///      `setManualPrice` intentionally bypasses this check.
    uint256 public constant MAX_PRICE_DEVIATION_PCT = 20;

    mapping(address => bool) public manualWhitelist;
    /// @dev Joop reply (item 9): off-chain bot sets a flag with 24h expiry.
    ///      Checked in isWhitelisted() alongside token-balance loop.
    mapping(address => uint256) public whitelistExpiry;
    uint256 public constant WHITELIST_FLAG_DURATION = 24 hours;

    event MetadataUpdated(string uri);
    event Whitelisted(address indexed account, bool indexed status);
    event WhitelistFlagSet(address indexed account, uint256 expiry);
    event AssetInfoUpdated(AssetInfo info);
    event PriceUpdated(uint256 price, uint256 timestamp);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event WhitelistTokenUpdated(address indexed token, uint256 minBalance);

    error InvalidParams();
    error ZeroAddress();
    error StalePrice();
    error InvalidPrice();
    error CapExceeded();
    error NotWhitelisted();
    error AssetInfoAlreadySet();
    error InsufficientBalance();
    error TransferFailed();
    error TooManyWhitelistTokens();
    error PriceDeviationTooHigh();

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _metadataURI,
        uint256 _cap,
        address _owner,
        address _govToken,
        uint256 _minGovBalance,
        address _priceFeed
    ) ERC20(_name, _symbol) {
        if (_owner == address(0) || _cap == 0) revert InvalidParams();
        if (_priceFeed == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(MINTER_ROLE, _owner);
        _grantRole(PAUSER_ROLE, _owner);
        metadataURI = _metadataURI;
        cap = _cap;
        govToken = IERC20(_govToken);
        minGovBalance = _minGovBalance;
        if (_govToken != address(0) && _minGovBalance > 0) {
            whitelistTokens[_govToken] = _minGovBalance;
            whitelistTokenList.push(_govToken);
        }
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function isWhitelisted(address _account) public view returns (bool) {
        if (manualWhitelist[_account]) return true;
        if (whitelistExpiry[_account] > block.timestamp) return true;
        uint256 len = whitelistTokenList.length;
        for (uint256 i; i < len; i++) {
            address token = whitelistTokenList[i];
            uint256 minBalance = whitelistTokens[token];
            if (minBalance > 0 && IERC20(token).balanceOf(_account) >= minBalance) return true;
        }
        return false;
    }

    function syncPrice() external nonReentrant {
        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        if (block.timestamp - updatedAt >= STALE_PRICE_THRESHOLD) revert StalePrice();
        if (answer <= 0) revert InvalidPrice();

        uint256 newPrice = uint256(answer);
        // Joop reply (item 7): reject suspicious moves — a compromised feed must
        // not jump the price (and thus minting power) in a single sync.
        if (currentPrice > 0) {
            uint256 deviation = newPrice > currentPrice ? newPrice - currentPrice : currentPrice - newPrice;
            if (deviation * 100 / currentPrice > MAX_PRICE_DEVIATION_PCT) revert PriceDeviationTooHigh();
        }

        currentPrice = newPrice;
        lastPriceUpdate = block.timestamp;
        emit PriceUpdated(newPrice, block.timestamp);
    }

    /// @notice Admin-set manual price (dead-oracle fallback).
    /// @dev A-5: this bypasses the Chainlink feed and its staleness threshold
    ///      entirely — `subscribe()` pricing becomes fully admin-controlled while
    ///      a manual price is in use. Intended for testnet/emergencies; for
    ///      production consider a timelock or removing this power.
    function setManualPrice(uint256 _price) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (_price == 0) revert InvalidPrice();
        currentPrice = _price;
        lastPriceUpdate = block.timestamp;
        emit PriceUpdated(_price, block.timestamp);
    }

    function mint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) nonReentrant {
        if (_to == address(0) || _amount == 0) revert InvalidParams();
        if (!isWhitelisted(_to)) revert NotWhitelisted();
        if (totalSupply() + _amount > cap) revert CapExceeded();
        _mint(_to, _amount);
    }

    /// @notice Mint RWA tokens for ETH at the current oracle/admin price.
    /// @dev E-5 fix: rejects when the price is stale — previously only
    ///      `syncPrice()` enforced freshness, so users could mint at an
    ///      arbitrarily old `currentPrice`.
    function subscribe() external payable nonReentrant {
        if (msg.value == 0) revert InsufficientBalance();
        if (!isWhitelisted(msg.sender)) revert NotWhitelisted();
        if (block.timestamp - lastPriceUpdate >= STALE_PRICE_THRESHOLD) revert StalePrice();
        if (currentPrice == 0) revert InvalidPrice();
        // Joop reply (item 7): never assume 8 feed decimals — read them from the
        // feed so a different-precision oracle can't mint 10^10x too many tokens.
        uint256 tokensToMint = (msg.value * currentPrice) / (10 ** priceFeed.decimals());
        if (tokensToMint == 0) revert InsufficientBalance();
        if (totalSupply() + tokensToMint > cap) revert CapExceeded();
        _mint(msg.sender, tokensToMint);
    }

    function withdrawETH(address payable _to, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount > address(this).balance) revert InsufficientBalance();
        (bool success, ) = _to.call{value: _amount}("");
        if (!success) revert TransferFailed();
        emit ETHWithdrawn(_to, _amount);
    }

    function sweepETH(address payable _to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (_to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        if (bal == 0) revert InsufficientBalance();
        (bool success, ) = _to.call{value: bal}("");
        if (!success) revert TransferFailed();
        emit ETHWithdrawn(_to, bal);
    }

    function setManualWhitelist(address _account, bool _status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_account == address(0)) revert ZeroAddress();
        manualWhitelist[_account] = _status;
        emit Whitelisted(_account, _status);
    }

    /// @notice Set a time-limited whitelist flag for an account.
    /// @dev Joop reply (item 9): off-chain bot/keeper sets this after evaluating
    ///      eligibility. Flag expires after WHITELIST_FLAG_DURATION (24h).
    ///      The bot calls this per qualifying user instead of the gas-heavy
    ///      token-balance loop running on every transfer.
    function setWhitelistFlag(address _account) external onlyRole(ALLOWLIST_MANAGER) {
        if (_account == address(0)) revert ZeroAddress();
        whitelistExpiry[_account] = block.timestamp + WHITELIST_FLAG_DURATION;
        emit WhitelistFlagSet(_account, whitelistExpiry[_account]);
    }

    function setWhitelistToken(address _token, uint256 _minBalance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) revert ZeroAddress();
        if (_minBalance == 0) {
            if (whitelistTokens[_token] != 0) {
                whitelistTokens[_token] = 0;
                uint256 len = whitelistTokenList.length;
                for (uint256 i; i < len; i++) {
                    if (whitelistTokenList[i] == _token) {
                        whitelistTokenList[i] = whitelistTokenList[len - 1];
                        whitelistTokenList.pop();
                        break;
                    }
                }
            }
        } else {
            if (whitelistTokens[_token] == 0) {
                // M-1 fix: bound the whitelist token list (see MAX_WHITELIST_TOKENS).
                if (whitelistTokenList.length >= MAX_WHITELIST_TOKENS) revert TooManyWhitelistTokens();
                whitelistTokenList.push(_token);
            }
            whitelistTokens[_token] = _minBalance;
        }
        if (address(govToken) == _token) {
            govToken = IERC20(_token);
            minGovBalance = _minBalance;
        }
        emit WhitelistTokenUpdated(_token, _minBalance);
    }

    function setMetadataURI(string calldata _uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        metadataURI = _uri;
        emit MetadataUpdated(_uri);
    }

    function setAssetInfo(
        string calldata _name,
        string calldata _description,
        string calldata _tokenType,
        string calldata _jurisdiction,
        string calldata _issuer,
        string calldata _riskLevel,
        uint256 _lockupDuration,
        uint256 _expectedReturnBps,
        string calldata _underlyingAsset,
        uint256 _redemptionDate,
        uint256 _redemptionPrice
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (assetInfoSet) revert AssetInfoAlreadySet();
        assetInfo = AssetInfo(
            _name, _description, _tokenType, _jurisdiction, _issuer, _riskLevel,
            _lockupDuration, _expectedReturnBps, _underlyingAsset,
            _redemptionDate, _redemptionPrice
        );
        assetInfoSet = true;
        emit AssetInfoUpdated(assetInfo);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    receive() external payable {}

    function _update(address _from, address _to, uint256 _value)
        internal
        override(ERC20, ERC20Pausable)
    {
        if (_from != address(0) && !isWhitelisted(_from)) revert NotWhitelisted();
        if (_to != address(0) && _from != address(0) && !isWhitelisted(_to)) revert NotWhitelisted();
        super._update(_from, _to, _value);
    }
}
