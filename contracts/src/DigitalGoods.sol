// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DutchAuctionLib.sol";

contract DigitalGoods is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using DutchAuctionLib for DutchAuctionLib.Params;

    enum PricingMode { Fixed, DutchAuction }
    enum ListingStatus { Active, Sold, Cancelled, Disputed, Refunded }

    struct Listing {
        uint256 id;
        address seller;
        string metadataURI;
        string description;
        string tags;
        bool isNFT;
        PricingMode pricing;
        uint256 price;
        DutchAuctionLib.Params auction;
        ListingStatus status;
        address buyer;
        uint256 escrowedAmount;
        uint256 createdAt;
        uint256 disputeDeadline;
        bool deliveryConfirmed;
        address paymentToken;
        string category;
        string deliveryURI;
    }

    uint256 public listingCount;
    uint256 public constant DISPUTE_TIMEOUT = 7 days;
    uint256 public constant PLATFORM_FEE_BPS = 300;
    uint256 public constant BPS = 10000;

    address public treasury;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => string) public deliveryHashes;
    mapping(address => bool) public allowedTokens;

    event Listed(uint256 indexed id, address indexed seller, PricingMode pricing, uint256 price, string metadataURI, string category);
    event Purchased(uint256 indexed id, address indexed buyer, uint256 paid);
    event DeliverySubmitted(uint256 indexed id, string deliveryHash);
    event DeliveryConfirmed(uint256 indexed id);
    event Disputed(uint256 indexed id);
    event Resolved(uint256 indexed id, bool toBuyer);
    event Cancelled(uint256 indexed id);
    event TreasuryUpdated(address indexed newTreasury);
    event TokenAllowed(address indexed token, bool allowed);

    error NotSeller();
    error NotBuyer();
    error WrongStatus();
    error AlreadyConfirmed();
    error PriceTooLow();
    error NoRefundNeeded();
    error ZeroAddress();
    error TransferFailed();
    error TokenNotAllowed();

    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setTokenAllowed(address _token, bool _allowed) external onlyOwner {
        if (_token == address(0)) revert ZeroAddress();
        allowedTokens[_token] = _allowed;
        emit TokenAllowed(_token, _allowed);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function listFixed(
        string calldata _metadataURI,
        string calldata _description,
        string calldata _tags,
        bool _isNFT,
        uint256 _price,
        string calldata _category,
        string calldata _deliveryURI
    ) external returns (uint256) {
        if (_price == 0) revert PriceTooLow();
        return _list(_metadataURI, _description, _tags, _isNFT, PricingMode.Fixed, _price, 0, 0, 0, _category, _deliveryURI);
    }

    function listDutch(
        string calldata _metadataURI,
        string calldata _description,
        string calldata _tags,
        bool _isNFT,
        uint256 _startPrice,
        uint256 _reservePrice,
        uint256 _duration,
        string calldata _category,
        string calldata _deliveryURI
    ) external returns (uint256) {
        DutchAuctionLib.validate(_startPrice, _reservePrice, _duration);
        return _list(_metadataURI, _description, _tags, _isNFT, PricingMode.DutchAuction, _startPrice, _reservePrice, _duration, block.timestamp, _category, _deliveryURI);
    }

    function _list(
        string calldata _metadataURI,
        string calldata _description,
        string calldata _tags,
        bool _isNFT,
        PricingMode _pricing,
        uint256 _price,
        uint256 _reservePrice,
        uint256 _duration,
        uint256 _startedAt,
        string calldata _category,
        string calldata _deliveryURI
    ) private returns (uint256) {
        listingCount++;
        uint256 id = listingCount;
        listings[id] = Listing({
            id: id,
            seller: msg.sender,
            metadataURI: _metadataURI,
            description: _description,
            tags: _tags,
            isNFT: _isNFT,
            pricing: _pricing,
            price: _price,
            auction: DutchAuctionLib.Params(_price, _reservePrice, _duration, _startedAt),
            status: ListingStatus.Active,
            buyer: address(0),
            escrowedAmount: 0,
            createdAt: block.timestamp,
            disputeDeadline: 0,
            deliveryConfirmed: false,
            paymentToken: address(0),
            category: _category,
            deliveryURI: _deliveryURI
        });
        emit Listed(id, msg.sender, _pricing, _price, _metadataURI, _category);
        return id;
    }

    function currentPrice(uint256 _id) public view returns (uint256) {
        Listing storage l = listings[_id];
        if (l.pricing == PricingMode.Fixed) return l.price;
        return l.auction.currentPrice();
    }

    function buy(uint256 _id) external payable nonReentrant {
        Listing storage l = listings[_id];
        if (l.status != ListingStatus.Active) revert WrongStatus();
        if (msg.sender == l.seller) revert WrongStatus();

        uint256 price = currentPrice(_id);
        if (msg.value < price) revert PriceTooLow();

        l.status = ListingStatus.Sold;
        l.buyer = msg.sender;
        l.paymentToken = address(0);
        // E-4 fix: escrow the FULL price; the platform fee is collected only when
        // the sale is finally released to the seller, so buyer refunds are 100%.
        l.escrowedAmount = price;
        l.disputeDeadline = block.timestamp + DISPUTE_TIMEOUT;

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refund,) = msg.sender.call{value: excess}("");
            if (!refund) revert TransferFailed();
        }

        emit Purchased(_id, msg.sender, price);
    }

    function buyWithToken(uint256 _id, address _token, uint256 _amount) external nonReentrant {
        if (!allowedTokens[_token]) revert TokenNotAllowed();
        Listing storage l = listings[_id];
        if (l.status != ListingStatus.Active) revert WrongStatus();
        if (msg.sender == l.seller) revert WrongStatus();

        uint256 price = currentPrice(_id);
        if (_amount < price) revert PriceTooLow();

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        l.status = ListingStatus.Sold;
        l.buyer = msg.sender;
        l.paymentToken = _token;
        l.escrowedAmount = price; // E-4 fix: full price escrowed, fee taken at release
        l.disputeDeadline = block.timestamp + DISPUTE_TIMEOUT;

        if (_amount > price) {
            IERC20(_token).safeTransfer(msg.sender, _amount - price);
        }

        emit Purchased(_id, msg.sender, price);
    }

    function submitDelivery(uint256 _id, string calldata _deliveryHash) external nonReentrant {
        Listing storage l = listings[_id];
        if (msg.sender != l.seller) revert NotSeller();
        if (l.status != ListingStatus.Sold || l.deliveryConfirmed) revert WrongStatus();
        deliveryHashes[_id] = _deliveryHash;
        emit DeliverySubmitted(_id, _deliveryHash);
    }

    function confirmDelivery(uint256 _id) external nonReentrant {
        Listing storage l = listings[_id];
        if (msg.sender != l.buyer) revert NotBuyer();
        if (l.status != ListingStatus.Sold || l.deliveryConfirmed) revert WrongStatus();

        l.deliveryConfirmed = true;
        _releaseToSeller(_id);
        emit DeliveryConfirmed(_id);
    }

    // H-2/A-4 fix: add nonReentrant for consistency with every other
    // state-changing function (defense-in-depth; no external calls here).
    function dispute(uint256 _id) external nonReentrant {
        Listing storage l = listings[_id];
        if (msg.sender != l.buyer && msg.sender != l.seller) revert WrongStatus();
        if (l.status != ListingStatus.Sold || l.deliveryConfirmed) revert WrongStatus();
        if (block.timestamp > l.disputeDeadline) revert WrongStatus();

        l.status = ListingStatus.Disputed;
        emit Disputed(_id);
    }

    function resolveAfterTimeout(uint256 _id) external nonReentrant {
        Listing storage l = listings[_id];
        if (msg.sender != l.buyer && msg.sender != l.seller) revert WrongStatus();
        if (l.status != ListingStatus.Disputed && l.status != ListingStatus.Sold) revert WrongStatus();
        if (l.deliveryConfirmed) revert AlreadyConfirmed();
        if (block.timestamp < l.disputeDeadline) revert WrongStatus();

        bool toSeller = l.status == ListingStatus.Sold;
        if (toSeller) {
            l.deliveryConfirmed = true;
            _releaseToSeller(_id);
        } else {
            l.status = ListingStatus.Refunded;
            _releaseToBuyer(_id);
        }
        emit Resolved(_id, toSeller);
    }

    /// @notice E-3 fix: platform arbitration for disputed listings.
    /// @dev Previously a disputed listing ALWAYS resolved to the buyer after the
    ///      timeout — sellers had no recourse against a free-riding buyer. The
    ///      owner (platform) can now rule either way, at any point while the
    ///      listing is Disputed. `resolveAfterTimeout` remains as the default
    ///      buyer-favorable fallback if no arbitration happens in time.
    /// @param _toBuyer true → refund the buyer in full; false → release to seller.
    function resolveDispute(uint256 _id, bool _toBuyer) external onlyOwner nonReentrant {
        Listing storage l = listings[_id];
        if (l.status != ListingStatus.Disputed) revert WrongStatus();

        if (_toBuyer) {
            l.status = ListingStatus.Refunded;
            _releaseToBuyer(_id);
        } else {
            l.deliveryConfirmed = true;
            _releaseToSeller(_id);
        }
        emit Resolved(_id, _toBuyer);
    }

    function cancelListing(uint256 _id) external nonReentrant {
        Listing storage l = listings[_id];
        if (msg.sender != l.seller) revert NotSeller();
        if (l.status != ListingStatus.Active) revert WrongStatus();

        l.status = ListingStatus.Cancelled;
        emit Cancelled(_id);
    }

    function _releaseToSeller(uint256 _id) private {
        Listing storage l = listings[_id];
        if (l.escrowedAmount == 0) revert NoRefundNeeded();
        uint256 amount = l.escrowedAmount;
        l.escrowedAmount = 0;
        // E-4 fix: the platform fee is collected here — at final release — so
        // buyer refunds (_releaseToBuyer) return the full price incl. the fee.
        uint256 fee = (amount * PLATFORM_FEE_BPS) / BPS;
        uint256 sellerAmount = amount - fee;
        if (l.paymentToken == address(0)) {
            if (fee > 0) {
                (bool feeSent,) = treasury.call{value: fee}("");
                if (!feeSent) revert TransferFailed();
            }
            (bool sent,) = l.seller.call{value: sellerAmount}("");
            if (!sent) revert TransferFailed();
        } else {
            if (fee > 0) IERC20(l.paymentToken).safeTransfer(treasury, fee);
            IERC20(l.paymentToken).safeTransfer(l.seller, sellerAmount);
        }
    }

    function _releaseToBuyer(uint256 _id) private {
        Listing storage l = listings[_id];
        if (l.escrowedAmount == 0) revert NoRefundNeeded();
        uint256 amount = l.escrowedAmount;
        l.escrowedAmount = 0;
        if (l.paymentToken == address(0)) {
            (bool sent,) = l.buyer.call{value: amount}("");
            if (!sent) revert TransferFailed();
        } else {
            IERC20(l.paymentToken).safeTransfer(l.buyer, amount);
        }
    }
}
