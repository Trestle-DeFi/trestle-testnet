// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DutchAuctionLib.sol";
import "./interfaces/IUserProfile.sol";

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
    /// @dev TRST-03 fix: Σ escrowedAmount actually held per token (address(0) =
    ///      native). Feeds `sweepStuck` and keeps the invariant
    ///      `escrowed (owed) <= token.balanceOf(this)` auditable on-chain.
    mapping(address => uint256) public totalEscrowed;

    event EscrowSwept(address indexed token, address indexed to, uint256 amount);

    /// @dev Optional UserProfile integration. address(0) = hooks skipped.
    address public userProfile;

    event UserProfileUpdated(address indexed userProfile);

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
    /// @dev TRST-03 fix: a fee-on-transfer (taxed) token MUST deliver at least
    ///      `price` to the escrow — before this guard, `escrowedAmount = price`
    ///      was recorded while strictly less arrived, making every exit path
    ///      (buyer refund, seller release, owner arbitration) permanently
    ///      revert with no sweep function. Fail loudly at purchase instead.
    error InsufficientReceived();

    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setTokenAllowed(address _token, bool _allowed) external onlyOwner {
        if (_token == address(0)) revert ZeroAddress();
        allowedTokens[_token] = _allowed;
        emit TokenAllowed(_token, _allowed);
    }

    function setUserProfile(address _userProfile) external onlyOwner {
        userProfile = _userProfile;
        emit UserProfileUpdated(_userProfile);
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

    function _notifyInteracted(address user) private {
        if (userProfile != address(0)) IUserProfile(userProfile).markInteracted(user);
    }

    function _notifyDealComplete(address a, address b) private {
        if (userProfile != address(0)) IUserProfile(userProfile).markDealComplete(a, b);
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
        _notifyInteracted(msg.sender);
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
        // TRESTLE-ARFAN-ZERORESERVE-20261021 fix: defence in depth. A zero
        // price (decayed to reserve, or an empty storage slot — the enum
        // default `Active` makes a nonexistent id look buyable) can never be
        // escrowed, so it must never be sold — also closes the phantom-id
        // footgun that wrote dead `Sold` state on empty slots.
        if (price == 0) revert PriceTooLow();
        if (msg.value < price) revert PriceTooLow();

        l.status = ListingStatus.Sold;
        l.buyer = msg.sender;
        l.paymentToken = address(0);
        // E-4 fix: escrow the FULL price; the platform fee is collected only when
        // the sale is finally released to the seller, so buyer refunds are 100%.
        l.escrowedAmount = price;
        totalEscrowed[address(0)] += price; // TRST-03 fix: obligation tracked
        l.disputeDeadline = block.timestamp + DISPUTE_TIMEOUT;

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refund,) = msg.sender.call{value: excess}("");
            if (!refund) revert TransferFailed();
        }

        emit Purchased(_id, msg.sender, price);
        _notifyInteracted(msg.sender);
        _notifyInteracted(l.seller);
    }

    /// @dev TRST-03 fix: measure the tokens the escrow ACTUALLY received via
    ///      balance-delta, require it to cover `price`, escrow `price`, and
    ///      refund the net surplus the contract holds (`received - price`, not
    ///      the nominal `_amount - price`, so the post-refund balance stays
    ///      exactly `escrowedAmount <= balanceOf(this)` even for taxed tokens).
    function buyWithToken(uint256 _id, address _token, uint256 _amount) external nonReentrant {
        if (!allowedTokens[_token]) revert TokenNotAllowed();
        Listing storage l = listings[_id];
        if (l.status != ListingStatus.Active) revert WrongStatus();
        if (msg.sender == l.seller) revert WrongStatus();

        uint256 price = currentPrice(_id);
        // TRESTLE-ARFAN-ZERORESERVE-20261021 fix: same zero-price guard as
        // `buy` — a zero-clearing token purchase would escrow 0 tokens and
        // strand the listing identically.
        if (price == 0) revert PriceTooLow();
        if (_amount < price) revert PriceTooLow();

        uint256 balanceBefore = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 received = IERC20(_token).balanceOf(address(this)) - balanceBefore;
        // A fee-on-transfer skim below `price` leaves the escrow permanently
        // insolvent — every exit path would revert. Reject the purchase.
        if (received < price) revert InsufficientReceived();

        l.status = ListingStatus.Sold;
        l.buyer = msg.sender;
        l.paymentToken = _token;
        l.escrowedAmount = price; // E-4 fix: full price escrowed, fee taken at release
        totalEscrowed[_token] += price; // TRST-03 fix: obligation tracked
        l.disputeDeadline = block.timestamp + DISPUTE_TIMEOUT;

        // Refund only the SURPLUS the escrow actually holds above its
        // obligation — pre-fix, refunding the nominal `_amount - price`
        // double-counted transfer fees and left `balance < escrowedAmount`.
        if (received > price) {
            IERC20(_token).safeTransfer(msg.sender, received - price);
        }

        emit Purchased(_id, msg.sender, price);
        _notifyInteracted(msg.sender);
        _notifyInteracted(l.seller);
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
        _notifyDealComplete(l.buyer, l.seller);
    }

    // H-2/A-4 fix: add nonReentrant for consistency with every other
    // state-changing function (defense-in-depth; no external calls here).
    function dispute(uint256 _id) external nonReentrant {
        Listing storage l = listings[_id];
        if (msg.sender != l.buyer && msg.sender != l.seller) revert WrongStatus();
        if (l.status != ListingStatus.Sold || l.deliveryConfirmed) revert WrongStatus();
        if (block.timestamp > l.disputeDeadline) revert WrongStatus();

        l.status = ListingStatus.Disputed;
        // TRESTLE-JKO4-ZEROSECOND-20261020 fix: refresh the arbitration window
        // on dispute. Previously the deadline was never reset, so at the exact
        // deadline second `dispute()` (t <= deadline) and the fallback
        // `resolveAfterTimeout()` (t >= deadline) were simultaneously valid —
        // an attacker buying a listing could atomically call both in one tx
        // and refund 100% of the escrow to themselves (free-riding) with zero
        // arbitration. Mirrors the FreelancerEscrow pattern.
        l.disputeDeadline = block.timestamp + DISPUTE_TIMEOUT;
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
            _notifyDealComplete(l.buyer, l.seller);
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
            _notifyDealComplete(l.buyer, l.seller);
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

    /// @notice TRST-03 hardening: sweep tokens held BEYOND tracked escrow
    ///         obligations (e.g. stranded balances or a FoT legacy escrow from
    ///         the pre-fix deployment) to the treasury. Escrowed funds are
    ///         never touchable — only the surplus above `totalEscrowed`.
    /// @param _token Token to sweep (address(0) = native surplus).
    function sweepStuck(address _token, address _to) external onlyOwner nonReentrant {
        if (_to == address(0)) revert ZeroAddress();
        uint256 balance = _token == address(0)
            ? address(this).balance
            : IERC20(_token).balanceOf(address(this));
        uint256 owed = totalEscrowed[_token];
        if (balance <= owed) revert NoRefundNeeded();
        uint256 amount = balance - owed;

        if (_token == address(0)) {
            (bool sent,) = _to.call{value: amount}("");
            if (!sent) revert TransferFailed();
        } else {
            IERC20(_token).safeTransfer(_to, amount);
        }
        emit EscrowSwept(_token, _to, amount);
    }

    function _releaseToSeller(uint256 _id) private {
        Listing storage l = listings[_id];
        if (l.escrowedAmount == 0) revert NoRefundNeeded();
        uint256 amount = l.escrowedAmount;
        l.escrowedAmount = 0;
        totalEscrowed[l.paymentToken] -= amount; // TRST-03 fix: obligation released
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
        totalEscrowed[l.paymentToken] -= amount; // TRST-03 fix: obligation released
        if (l.paymentToken == address(0)) {
            (bool sent,) = l.buyer.call{value: amount}("");
            if (!sent) revert TransferFailed();
        } else {
            IERC20(l.paymentToken).safeTransfer(l.buyer, amount);
        }
    }
}
