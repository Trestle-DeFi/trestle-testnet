// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DutchAuctionLib.sol";
import "./interfaces/IERC4626.sol";
import "./interfaces/IUserProfile.sol";

contract FreelancerEscrow is Ownable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using DutchAuctionLib for DutchAuctionLib.Params;

    bytes32 public constant DISPUTE_AGENT_ROLE = keccak256("DISPUTE_AGENT_ROLE");

    enum ProjectStatus { Open, InProgress, Completed, Cancelled, Disputed }
    enum PricingMode { Fixed, DutchAuction }
    enum MilestoneStatus { Pending, Submitted, Approved, Rejected }

    struct GigMilestone {
        string description;
        uint256 amount;
        uint256 deadline;
    }

    struct Gig {
        uint256 id;
        address freelancer;
        string title;
        string descriptionURI;
        string github;
        string portfolioURI;
        string category;
        uint256 minBudget;
        uint256 price;
        bool active;
        GigMilestone[] milestones;
    }

    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        MilestoneStatus status;
        uint256 submittedAt;
        string deliveryHash;
    }

    struct Project {
        uint256 id;
        address client;
        address freelancer;
        string title;
        string descriptionURI;
        string github;
        string category;
        uint256 durationDays;
        PricingMode pricing;
        uint256 totalBudget;
        DutchAuctionLib.Params auction;
        ProjectStatus status;
        Milestone[] milestones;
        uint256 escrowedAmount;
        uint256 disputeDeadline;
        uint256 createdAt;
        address paymentToken;
    }

    uint256 public projectCount;
    uint256 public gigCount;
    uint256 public constant PLATFORM_FEE_BPS = 300;
    uint256 public constant BPS = 10000;
    uint256 public constant MIN_MILESTONES = 2;
    uint256 public constant MILESTONE_APPROVAL_TIMEOUT = 14 days;
    uint256 public constant DISPUTE_TIMEOUT = 7 days;

    address public treasury;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Gig) public gigs;

    address public yieldVault;
    bool public yieldEnabled = true;
    address public feeDistributor;
    mapping(uint256 => uint256) public projectShares;
    /// @dev E-2 fix: number of projects with unredeemed vault shares. Blocks
    ///      `setYieldVault` swaps while outstanding shares exist (shares are not
    ///      tracked per-vault, so a swap would redeem against the wrong vault).
    uint256 private _projectsWithShares;
    /// @dev Migration runbook (immutable + migrate decision): Σ escrowedAmount
    ///      per payment token (address(0) = native). Lets ops verify all
    ///      obligations are settled before sweeping a deployment, and exposes
    ///      the idle surplus. Mirror of Σ projects[_id].escrowedAmount.
    mapping(address => uint256) public totalEscrowed;
    mapping(address => bool) public allowedTokens;

    /// @dev Optional UserProfile integration. address(0) = hooks skipped.
    address public userProfile;

    event UserProfileUpdated(address indexed userProfile);

    event ProjectCreated(uint256 indexed id, address indexed client, string title, uint256 budget);
    event ProjectFunded(uint256 indexed id, address indexed client, uint256 amount);
    event ProjectAccepted(uint256 indexed id, address indexed freelancer);
    event MilestoneSubmitted(uint256 indexed id, uint256 milestoneIndex, string deliveryHash);
    event MilestoneApproved(uint256 indexed id, uint256 milestoneIndex, uint256 amount);
    event MilestoneRejected(uint256 indexed id, uint256 milestoneIndex);
    event ProjectCompleted(uint256 indexed id);
    event Disputed(uint256 indexed id);
    event Resolved(uint256 indexed id, bool toFreelancer);
    event Cancelled(uint256 indexed id);
    event GigCreated(uint256 indexed id, address indexed freelancer, string title, uint256 price);
    event GigUpdated(uint256 indexed id);
    event GigCancelled(uint256 indexed id);
    event GigHired(uint256 indexed gigId, uint256 indexed projectId, address indexed client);
    event TreasuryUpdated(address indexed newTreasury);
    event YieldVaultUpdated(address indexed newVault);
    event YieldEnabledUpdated(bool enabled);
    event FeeDistributorUpdated(address indexed newFeeDistributor);
    event FundsDepositedToVault(uint256 indexed id, uint256 assets);
    event FundsWithdrawnFromVault(uint256 indexed id, uint256 principal, uint256 yieldOut);
    event YieldDistributed(uint256 indexed id, address token, uint256 amount);
    event TokenAllowed(address indexed token, bool allowed);
    event EscrowMigrated(address indexed newEscrow, address indexed token, uint256 amount);

    error NotClient();
    error NotFreelancer();
    error NotParticipant();
    error WrongStatus();
    error WrongMilestone();
    error BudgetTooLow();
    error AlreadyAccepted();
    error NoFunds();
    error PastDeadline();
    error MixedPayment();
    error InvalidMilestoneAmount();
    error TooFewMilestones();
    error ZeroAddress();
    error TransferFailed();
    error TokenNotAllowed();
    error ZeroShares();
    error VaultMigrationBlocked();
    error SelfAccept();
    error UnsettledObligations();

    modifier onlyClient(uint256 _id) {
        if (msg.sender != projects[_id].client) revert NotClient();
        _;
    }

    modifier onlyFreelancer(uint256 _id) {
        if (msg.sender != projects[_id].freelancer) revert NotFreelancer();
        _;
    }

    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISPUTE_AGENT_ROLE, msg.sender);
    }

    function setUserProfile(address _userProfile) external onlyRole(DEFAULT_ADMIN_ROLE) {
        userProfile = _userProfile;
        emit UserProfileUpdated(_userProfile);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setTokenAllowed(address _token, bool _allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) revert ZeroAddress();
        allowedTokens[_token] = _allowed;
        emit TokenAllowed(_token, _allowed);
    }

    function setYieldVault(address _yieldVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_yieldVault == address(0)) revert ZeroAddress();
        // E-2 fix: block vault swaps while any project still holds shares of the
        // current vault — `projectShares` is not per-vault, so a swap would make
        // every payout redeem against the wrong vault and revert.
        if (_yieldVault != yieldVault && _projectsWithShares > 0) revert VaultMigrationBlocked();
        yieldVault = _yieldVault;
        emit YieldVaultUpdated(_yieldVault);
    }

    /// @notice E-2: number of projects with outstanding vault shares. When
    ///         non-zero, `setYieldVault` cannot point the contract at a new vault.
    function projectsWithShares() external view returns (uint256) {
        return _projectsWithShares;
    }

    /// @notice Toggle auto-yield.
    /// @dev E-2 fix: this flag now only gates NEW deposits. Outstanding vault
    ///      shares are always redeemable — disabling yield no longer strands
    ///      already-deposited escrow or bricks payouts.
    function setYieldEnabled(bool _enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        yieldEnabled = _enabled;
        emit YieldEnabledUpdated(_enabled);
    }

    function setFeeDistributor(address _feeDistributor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeDistributor != address(0), "zero address");
        feeDistributor = _feeDistributor;
        emit FeeDistributorUpdated(_feeDistributor);
    }

    function _send(address _token, address _to, uint256 _amount) private {
        if (_amount == 0) return;
        if (_token == address(0)) {
            (bool s,) = _to.call{value: _amount}("");
            if (!s) revert TransferFailed();
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    function _validateMilestones(
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts,
        uint256[] calldata _milestoneDeadlines,
        uint256 _totalBudget,
        uint256 _durationDays
    ) private view {
        uint256 len = _milestoneDescriptions.length;
        if (len < MIN_MILESTONES || len != _milestoneAmounts.length || len != _milestoneDeadlines.length) revert TooFewMilestones();
        if (_totalBudget == 0) revert BudgetTooLow();
        // Joop reply (item 13): make `durationDays` meaningful — every milestone
        // deadline must fit within the project duration. (Note: 0 = no limit.)
        uint256 maxDeadline = _durationDays * 1 days;
        uint256 totalCheck;
        for (uint256 i; i < len; i++) {
            if (_milestoneAmounts[i] == 0) revert InvalidMilestoneAmount();
            if (_milestoneDeadlines[i] <= block.timestamp) revert PastDeadline();
            if (i > 0 && _milestoneDeadlines[i] <= _milestoneDeadlines[i - 1]) revert InvalidMilestoneAmount();
            if (_durationDays > 0 && _milestoneDeadlines[i] > block.timestamp + maxDeadline) revert PastDeadline();
            totalCheck += _milestoneAmounts[i];
        }
        if (totalCheck != _totalBudget) revert BudgetTooLow();
    }

    function _notifyInteracted(address user) private {
        if (userProfile != address(0)) IUserProfile(userProfile).markInteracted(user);
    }

    function _notifyDealComplete(address a, address b) private {
        if (userProfile != address(0)) IUserProfile(userProfile).markDealComplete(a, b);
    }

    function _approveMilestoneLogic(uint256 _id, uint256 _milestoneIndex) private {
        Project storage p = projects[_id];
        Milestone storage m = p.milestones[_milestoneIndex];

        m.status = MilestoneStatus.Approved;
        uint256 amount = m.amount;
        if (p.escrowedAmount < amount) revert NoFunds();

        // E-7 fix: pay based on `available` (what the vault actually returned),
        // so a vault shortfall degrades the payout instead of reverting it.
        (uint256 available, uint256 yieldOut) = _withdrawFromVault(_id, amount);
        p.escrowedAmount -= amount;
        totalEscrowed[p.paymentToken] -= amount; // migration runbook: obligation released
        uint256 fee = (available * PLATFORM_FEE_BPS) / BPS;
        uint256 netAmount = available - fee;
        _send(p.paymentToken, treasury, fee);
        _send(p.paymentToken, p.freelancer, netAmount);
        if (yieldOut > 0) _distributeYield(_id, p.paymentToken, yieldOut);

        emit MilestoneApproved(_id, _milestoneIndex, amount);

        bool allDone = true;
        for (uint256 i; i < p.milestones.length; i++) {
            if (p.milestones[i].status != MilestoneStatus.Approved) {
                allDone = false;
                break;
            }
        }
        if (allDone) {
            p.status = ProjectStatus.Completed;
            if (p.escrowedAmount > 0) {
                uint256 remaining = p.escrowedAmount;
                (uint256 remainingAvail, uint256 remYield) = _withdrawFromVault(_id, remaining);
                p.escrowedAmount = 0;
                if (remainingAvail > 0) _send(p.paymentToken, p.freelancer, remainingAvail);
                if (remYield > 0) _distributeYield(_id, p.paymentToken, remYield);
            }
            emit ProjectCompleted(_id);
            _notifyDealComplete(p.client, p.freelancer);
        }
    }

    /// @dev Returns the sum of all non-approved milestone amounts.
    function _remainingMilestoneAmount(Project storage p) private view returns (uint256) {
        uint256 total;
        for (uint256 i; i < p.milestones.length; i++) {
            if (p.milestones[i].status != MilestoneStatus.Approved) {
                total += p.milestones[i].amount;
            }
        }
        return total;
    }

    /// @dev TRESTLE-2026-01 fix: when a Dutch-auction project is funded at a
    ///      discounted price, the original milestone amounts (validated against
    ///      maxBudget) exceed the escrowed amount. Scale them proportionally so
    ///      that sum(milestones) == escrowedAmount and the normal payout path
    ///      works. Rounding dust goes to the last milestone.
    function _scaleMilestonesForDutch(uint256 _id) private {
        Project storage p = projects[_id];
        if (p.pricing != PricingMode.DutchAuction) return;
        uint256 escrowed = p.escrowedAmount;
        if (escrowed == 0 || escrowed >= p.totalBudget) return;

        uint256 len = p.milestones.length;
        uint256 scaledSum;
        for (uint256 i; i < len; i++) {
            uint256 scaled = (p.milestones[i].amount * escrowed) / p.totalBudget;
            if (scaled == 0) scaled = 1; // prevent zero-amount milestones
            p.milestones[i].amount = scaled;
            scaledSum += scaled;
        }
        // Assign rounding dust to the last milestone
        if (scaledSum < escrowed) {
            p.milestones[len - 1].amount += escrowed - scaledSum;
        }
    }

    function _vaultAsset() private view returns (address) {
        if (yieldVault == address(0)) return address(0x1);
        return IERC4626(yieldVault).asset();
    }

    function _depositToVault(uint256 _id) private {
        Project storage p = projects[_id];
        if (!yieldEnabled || yieldVault == address(0) || p.escrowedAmount == 0) return;
        if (_vaultAsset() != p.paymentToken) return;
        uint256 assets = p.escrowedAmount;
        uint256 sharesBefore = IERC4626(yieldVault).balanceOf(address(this));
        if (p.paymentToken == address(0)) {
            IERC4626(yieldVault).deposit{value: assets}(assets, address(this));
        } else {
            IERC20(p.paymentToken).safeIncreaseAllowance(yieldVault, assets);
            IERC4626(yieldVault).deposit(assets, address(this));
        }
        uint256 sharesAdded = IERC4626(yieldVault).balanceOf(address(this)) - sharesBefore;
        // H-1 fix: fail loudly if an inflation-attacked vault granted zero
        // shares — silently crediting 0 would strand the escrow in the vault
        // and brick later payouts (see A-2).
        if (sharesAdded == 0) revert ZeroShares();
        if (projectShares[_id] == 0) _projectsWithShares++; // E-2 migration lock
        projectShares[_id] += sharesAdded;
        emit FundsDepositedToVault(_id, assets);
    }

    /// @notice Redeems the pro-rata vault shares backing `_principal`.
    /// @return available Tokens actually made payable for this withdrawal. May be
    ///         less than `_principal` if the vault suffers a shortfall (E-7 fix:
    ///         pay what exists instead of reverting the entire payout).
    /// @return yieldOut Surplus assets above the principal (project yield).
    /// @dev E-2 fix: no longer gated by `yieldEnabled` — that flag only stops NEW
    ///      deposits; outstanding shares must always stay redeemable or payouts
    ///      brick. A-2 fix: dust principals redeem a minimum of 1 share instead
    ///      of rounding down to 0 (which silently did nothing and bricked tiny
    ///      milestone payouts). Floor rounding keeps cumulative redemptions
    ///      pro-rata so shares always cover the remaining escrow.
    function _withdrawFromVault(uint256 _id, uint256 _principal)
        private
        returns (uint256 available, uint256 yieldOut)
    {
        if (_principal == 0) return (0, 0);
        uint256 shares = projectShares[_id];
        if (yieldVault == address(0) || shares == 0) return (_principal, 0); // escrow held in-contract
        uint256 escrowed = projects[_id].escrowedAmount;
        if (escrowed == 0) return (0, 0);

        uint256 sharesOut = _principal >= escrowed ? shares : (shares * _principal) / escrowed;
        if (sharesOut == 0) sharesOut = 1; // A-2 fix: dust principal still redeems something
        if (sharesOut > shares) sharesOut = shares; // defensive

        uint256 assetsOut = IERC4626(yieldVault).redeem(sharesOut, address(this), address(this));
        uint256 remaining = shares - sharesOut;
        projectShares[_id] = remaining;
        if (remaining == 0) _projectsWithShares--;

        available = assetsOut < _principal ? assetsOut : _principal; // E-7 shortfall fallback
        if (assetsOut > available) yieldOut = assetsOut - available;
        emit FundsWithdrawnFromVault(_id, available, yieldOut);
    }

    function _distributeYield(uint256 _id, address _token, uint256 _amount) private {
        if (_amount == 0) return;
        if (feeDistributor == address(0)) {
            _send(_token, treasury, _amount);
        } else {
            _send(_token, feeDistributor, _amount);
        }
        emit YieldDistributed(_id, _token, _amount);
    }

    function createProjectFixed(
        string calldata _title,
        string calldata _descriptionURI,
        string calldata _github,
        string calldata _category,
        uint256 _durationDays,
        uint256 _totalBudget,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts,
        uint256[] calldata _milestoneDeadlines
    ) external returns (uint256) {
        _validateMilestones(_milestoneDescriptions, _milestoneAmounts, _milestoneDeadlines, _totalBudget, _durationDays);

        projectCount++;
        uint256 id = projectCount;
        Project storage p = projects[id];
        p.id = id;
        p.client = msg.sender;
        p.title = _title;
        p.descriptionURI = _descriptionURI;
        p.github = _github;
        p.category = _category;
        p.durationDays = _durationDays;
        p.pricing = PricingMode.Fixed;
        p.totalBudget = _totalBudget;
        p.status = ProjectStatus.Open;
        p.createdAt = block.timestamp;

        for (uint256 i; i < _milestoneDescriptions.length; i++) {
            p.milestones.push(Milestone(_milestoneDescriptions[i], _milestoneAmounts[i], _milestoneDeadlines[i], MilestoneStatus.Pending, 0, ""));
        }
        emit ProjectCreated(id, msg.sender, _title, _totalBudget);
        _notifyInteracted(msg.sender);
        return id;
    }

    function createProjectDutch(
        string calldata _title,
        string calldata _descriptionURI,
        string calldata _github,
        string calldata _category,
        uint256 _durationDays,
        uint256 _maxBudget,
        uint256 _reserveBudget,
        uint256 _duration,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts,
        uint256[] calldata _milestoneDeadlines
    ) external returns (uint256) {
        DutchAuctionLib.validate(_maxBudget, _reserveBudget, _duration);
        _validateMilestones(_milestoneDescriptions, _milestoneAmounts, _milestoneDeadlines, _maxBudget, _durationDays);

        projectCount++;
        uint256 id = projectCount;
        Project storage p = projects[id];
        p.id = id;
        p.client = msg.sender;
        p.title = _title;
        p.descriptionURI = _descriptionURI;
        p.github = _github;
        p.category = _category;
        p.durationDays = _durationDays;
        p.pricing = PricingMode.DutchAuction;
        p.totalBudget = _maxBudget;
        p.auction = DutchAuctionLib.Params(_maxBudget, _reserveBudget, _duration, block.timestamp);
        p.status = ProjectStatus.Open;
        p.createdAt = block.timestamp;

        for (uint256 i; i < _milestoneDescriptions.length; i++) {
            p.milestones.push(Milestone(_milestoneDescriptions[i], _milestoneAmounts[i], _milestoneDeadlines[i], MilestoneStatus.Pending, 0, ""));
        }
        emit ProjectCreated(id, msg.sender, _title, _maxBudget);
        _notifyInteracted(msg.sender);
        return id;
    }

    function createGig(
        string calldata _title,
        string calldata _descriptionURI,
        string calldata _github,
        string calldata _portfolioURI,
        string calldata _category,
        uint256 _minBudget,
        uint256 _price,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts,
        uint256[] calldata _milestoneDeadlines
    ) external returns (uint256) {
        _validateMilestones(_milestoneDescriptions, _milestoneAmounts, _milestoneDeadlines, _price, 0);

        gigCount++;
        uint256 id = gigCount;
        Gig storage g = gigs[id];
        g.id = id;
        g.freelancer = msg.sender;
        g.title = _title;
        g.descriptionURI = _descriptionURI;
        g.github = _github;
        g.portfolioURI = _portfolioURI;
        g.category = _category;
        g.minBudget = _minBudget;
        g.price = _price;
        g.active = true;
        for (uint256 i; i < _milestoneDescriptions.length; i++) {
            g.milestones.push(GigMilestone(_milestoneDescriptions[i], _milestoneAmounts[i], _milestoneDeadlines[i]));
        }
        emit GigCreated(id, msg.sender, _title, _price);
        _notifyInteracted(msg.sender);
        return id;
    }

    function updateGig(
        uint256 _gigId,
        string calldata _title,
        string calldata _descriptionURI,
        uint256 _price,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts,
        uint256[] calldata _milestoneDeadlines
    ) external {
        Gig storage g = gigs[_gigId];
        if (msg.sender != g.freelancer) revert NotFreelancer();
        if (!g.active) revert WrongStatus();
        _validateMilestones(_milestoneDescriptions, _milestoneAmounts, _milestoneDeadlines, _price, 0);

        g.title = _title;
        g.descriptionURI = _descriptionURI;
        g.price = _price;
        delete g.milestones;
        for (uint256 i; i < _milestoneDescriptions.length; i++) {
            g.milestones.push(GigMilestone(_milestoneDescriptions[i], _milestoneAmounts[i], _milestoneDeadlines[i]));
        }
        emit GigUpdated(_gigId);
    }

    function cancelGig(uint256 _gigId) external {
        Gig storage g = gigs[_gigId];
        if (msg.sender != g.freelancer) revert NotFreelancer();
        if (!g.active) revert WrongStatus();
        g.active = false;
        emit GigCancelled(_gigId);
    }

    function hireGig(uint256 _gigId) external payable nonReentrant returns (uint256) {
        Gig storage g = gigs[_gigId];
        if (!g.active) revert WrongStatus();
        if (msg.sender == g.freelancer) revert SelfAccept(); // E-6 fix
        if (msg.value < g.price) revert BudgetTooLow();

        projectCount++;
        uint256 id = projectCount;
        Project storage p = projects[id];
        p.id = id;
        p.client = msg.sender;
        p.freelancer = g.freelancer;
        p.title = g.title;
        p.descriptionURI = g.descriptionURI;
        p.pricing = PricingMode.Fixed;
        p.totalBudget = g.price;
        p.status = ProjectStatus.InProgress;
        p.escrowedAmount = g.price;
        totalEscrowed[address(0)] += g.price; // migration runbook: obligation tracked
        p.paymentToken = address(0);
        p.createdAt = block.timestamp;

        uint256 mlen = g.milestones.length;
        for (uint256 i; i < mlen; i++) {
            if (g.milestones[i].deadline <= block.timestamp) revert PastDeadline();
            p.milestones.push(Milestone(
                g.milestones[i].description,
                g.milestones[i].amount,
                g.milestones[i].deadline,
                MilestoneStatus.Pending, 0, ""
            ));
        }

        uint256 excess = msg.value - g.price;
        if (excess > 0) {
            (bool refund,) = msg.sender.call{value: excess}("");
            if (!refund) revert TransferFailed();
        }

        emit GigHired(_gigId, id, msg.sender);
        emit ProjectCreated(id, msg.sender, g.title, g.price);
        emit ProjectAccepted(id, g.freelancer);
        _notifyInteracted(msg.sender);
        _notifyInteracted(g.freelancer);
        _depositToVault(id);
        return id;
    }

    function getGigMilestoneCount(uint256 _gigId) external view returns (uint256) {
        return gigs[_gigId].milestones.length;
    }

    function currentBudget(uint256 _id) public view returns (uint256) {
        Project storage p = projects[_id];
        if (p.pricing == PricingMode.Fixed) return p.totalBudget;
        if (p.freelancer != address(0)) return p.totalBudget;
        return p.auction.currentPrice();
    }

    function fundProject(uint256 _id) external payable nonReentrant onlyClient(_id) {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.Open) revert WrongStatus();
        if (p.escrowedAmount > 0) revert MixedPayment();
        uint256 budget = currentBudget(_id);
        if (msg.value < budget) revert BudgetTooLow();
        p.paymentToken = address(0);
        p.escrowedAmount = budget;
        totalEscrowed[address(0)] += budget; // migration runbook: obligation tracked
        // TRESTLE-2026-01 fix: scale milestone amounts to match discounted escrow
        _scaleMilestonesForDutch(_id);
        uint256 excess = msg.value - budget;
        if (excess > 0) {
            (bool refund,) = msg.sender.call{value: excess}("");
            if (!refund) revert TransferFailed();
        }
        emit ProjectFunded(_id, msg.sender, budget);
        _depositToVault(_id);
    }

    function fundProjectWithToken(uint256 _id, address _token, uint256 _amount) external nonReentrant onlyClient(_id) {
        if (!allowedTokens[_token]) revert TokenNotAllowed();
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.Open) revert WrongStatus();
        if (p.escrowedAmount > 0) revert MixedPayment();
        uint256 budget = currentBudget(_id);
        if (_amount < budget) revert BudgetTooLow();
        // E-1 fix: pull the FULL `_amount`, then refund the excess out of what
        // was just pulled. (Previously only `budget` was pulled while the excess
        // was refunded from the contract's own balance — letting any client
        // drain contract-held tokens, e.g. other projects' escrow.)
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        p.paymentToken = _token;
        p.escrowedAmount = budget;
        totalEscrowed[_token] += budget; // migration runbook: obligation tracked
        // TRESTLE-2026-01 fix: scale milestone amounts to match discounted escrow
        _scaleMilestonesForDutch(_id);
        if (_amount > budget) {
            IERC20(_token).safeTransfer(msg.sender, _amount - budget);
        }
        emit ProjectFunded(_id, msg.sender, budget);
        _depositToVault(_id);
    }

    function acceptProject(uint256 _id) external nonReentrant {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.Open) revert WrongStatus();
        if (p.freelancer != address(0)) revert AlreadyAccepted();
        if (p.escrowedAmount == 0) revert NoFunds();
        // E-6 fix: a client must not be able to accept their own project and
        // approve their own milestones (self-dealing).
        if (msg.sender == p.client) revert SelfAccept();
        // TRESTLE-2026-01 invariant guard: reject if remaining milestones
        // exceed escrow (should not happen after scaling, but defense-in-depth).
        if (_remainingMilestoneAmount(p) > p.escrowedAmount) revert NoFunds();

        p.freelancer = msg.sender;
        p.status = ProjectStatus.InProgress;
        emit ProjectAccepted(_id, msg.sender);
        _notifyInteracted(msg.sender);
        _notifyInteracted(p.client);
    }

    function applyAndAcceptDutch(uint256 _id) external nonReentrant {
        Project storage p = projects[_id];
        if (p.pricing != PricingMode.DutchAuction) revert WrongStatus();
        if (p.status != ProjectStatus.Open) revert WrongStatus();
        if (p.freelancer != address(0)) revert AlreadyAccepted();
        if (p.escrowedAmount == 0) revert NoFunds();
        if (msg.sender == p.client) revert SelfAccept(); // E-6 fix
        // TRESTLE-2026-01 invariant guard
        if (_remainingMilestoneAmount(p) > p.escrowedAmount) revert NoFunds();

        p.freelancer = msg.sender;
        p.status = ProjectStatus.InProgress;
        emit ProjectAccepted(_id, msg.sender);
        _notifyInteracted(msg.sender);
        _notifyInteracted(p.client);
    }

    function submitMilestone(uint256 _id, uint256 _milestoneIndex, string calldata _deliveryHash) external onlyFreelancer(_id) nonReentrant {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.InProgress) revert WrongStatus();
        if (_milestoneIndex >= p.milestones.length) revert WrongMilestone();
        Milestone storage m = p.milestones[_milestoneIndex];
        if (m.status != MilestoneStatus.Pending && m.status != MilestoneStatus.Rejected) revert WrongMilestone();
        if (block.timestamp > m.deadline) revert WrongMilestone();

        m.status = MilestoneStatus.Submitted;
        m.submittedAt = block.timestamp;
        m.deliveryHash = _deliveryHash;
        emit MilestoneSubmitted(_id, _milestoneIndex, _deliveryHash);
    }

    function approveMilestone(uint256 _id, uint256 _milestoneIndex) external onlyClient(_id) nonReentrant {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.InProgress) revert WrongStatus();
        if (_milestoneIndex >= p.milestones.length) revert WrongMilestone();
        Milestone storage m = p.milestones[_milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) revert WrongMilestone();
        _approveMilestoneLogic(_id, _milestoneIndex);
    }

    function rejectMilestone(uint256 _id, uint256 _milestoneIndex) external onlyClient(_id) nonReentrant {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.InProgress) revert WrongStatus();
        if (_milestoneIndex >= p.milestones.length) revert WrongMilestone();
        Milestone storage m = p.milestones[_milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) revert WrongMilestone();

        m.status = MilestoneStatus.Rejected;
        emit MilestoneRejected(_id, _milestoneIndex);
    }

    function autoApproveMilestone(uint256 _id, uint256 _milestoneIndex) external nonReentrant {
        Project storage p = projects[_id];
        // TRESTLE-2026-02 fix: the original `approveMilestone` checks InProgress,
        // but this sibling path omitted the guard — letting a freelancer drain
        // 99% of disputed escrow via the 14-day timeout while the dispute
        // window is still open.
        if (p.status != ProjectStatus.InProgress) revert WrongStatus();
        if (msg.sender != p.client && msg.sender != p.freelancer) revert NotParticipant();
        if (_milestoneIndex >= p.milestones.length) revert WrongMilestone();
        Milestone storage m = p.milestones[_milestoneIndex];
        if (m.status != MilestoneStatus.Submitted) revert WrongMilestone();
        if (block.timestamp < m.submittedAt + MILESTONE_APPROVAL_TIMEOUT) revert WrongMilestone();
        _approveMilestoneLogic(_id, _milestoneIndex);
    }

    function disputeProject(uint256 _id) external nonReentrant {
        Project storage p = projects[_id];
        if (msg.sender != p.client && msg.sender != p.freelancer) revert NotParticipant();
        if (p.status != ProjectStatus.InProgress) revert WrongStatus();

        p.status = ProjectStatus.Disputed;
        p.disputeDeadline = block.timestamp + DISPUTE_TIMEOUT;
        emit Disputed(_id);
    }

    function resolveDispute(uint256 _id, bool _toFreelancer) external onlyRole(DISPUTE_AGENT_ROLE) nonReentrant {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.Disputed) revert WrongStatus();

        p.status = ProjectStatus.Completed;
        uint256 amount = p.escrowedAmount;
        (uint256 available, uint256 yieldOut) = _withdrawFromVault(_id, amount);
        p.escrowedAmount = 0;
        totalEscrowed[p.paymentToken] -= amount; // migration runbook: obligation released
        address recipient = _toFreelancer ? p.freelancer : p.client;
        if (available > 0) {
            if (_toFreelancer) {
                uint256 fee = (available * PLATFORM_FEE_BPS) / BPS;
                uint256 netAmount = available - fee;
                if (fee > 0) _send(p.paymentToken, treasury, fee);
                _send(p.paymentToken, recipient, netAmount);
            } else {
                // A-3 fix: the client gets a FULL refund — no platform fee on
                // returning the client's own undelivered funds.
                _send(p.paymentToken, recipient, available);
            }
        }
        if (yieldOut > 0) _distributeYield(_id, p.paymentToken, yieldOut);
        emit Resolved(_id, _toFreelancer);
    }

    function autoResolveDispute(uint256 _id) external nonReentrant {
        Project storage p = projects[_id];
        if (msg.sender != p.client && msg.sender != p.freelancer) revert NotParticipant();
        if (p.status != ProjectStatus.Disputed) revert WrongStatus();
        if (block.timestamp < p.disputeDeadline) revert WrongStatus();

        uint256 approvedCount;
        for (uint256 i; i < p.milestones.length; i++) {
            if (p.milestones[i].status == MilestoneStatus.Approved) {
                approvedCount++;
            }
        }

        p.status = ProjectStatus.Completed;
        uint256 amount = p.escrowedAmount;
        (uint256 available, uint256 yieldOut) = _withdrawFromVault(_id, amount);
        p.escrowedAmount = 0;
        totalEscrowed[p.paymentToken] -= amount; // migration runbook: obligation released

        address recipient;
        bool toFreelancer = approvedCount * 2 > p.milestones.length;
        if (toFreelancer) {
            recipient = p.freelancer;
        } else {
            recipient = p.client;
        }
        if (available > 0) {
            if (toFreelancer) {
                uint256 fee = (available * PLATFORM_FEE_BPS) / BPS;
                uint256 netAmount = available - fee;
                if (fee > 0) _send(p.paymentToken, treasury, fee);
                _send(p.paymentToken, recipient, netAmount);
            } else {
                _send(p.paymentToken, recipient, available); // A-3 fix: full refund
            }
        }
        if (yieldOut > 0) _distributeYield(_id, p.paymentToken, yieldOut);
        emit Resolved(_id, toFreelancer);
    }

    function cancelProject(uint256 _id) external nonReentrant onlyClient(_id) {
        Project storage p = projects[_id];
        if (p.status != ProjectStatus.Open) revert WrongStatus();

        p.status = ProjectStatus.Cancelled;
        uint256 amount = p.escrowedAmount;
        (uint256 available, uint256 yieldOut) = _withdrawFromVault(_id, amount);
        p.escrowedAmount = 0;
        totalEscrowed[p.paymentToken] -= amount; // migration runbook: obligation released
        if (available > 0) {
            _send(p.paymentToken, msg.sender, available);
        }
        if (yieldOut > 0) _distributeYield(_id, p.paymentToken, yieldOut);
        emit Cancelled(_id);
    }

    /// @notice Migration runbook (immutable + migrate decision): sweep the idle
    ///         surplus of `_token` (address(0) = native) to a fresh deployment.
    /// @dev Code-enforced runbook — reverts unless (a) no project holds vault
    ///      shares of the current vault and (b) every escrow obligation is
    ///      settled (`totalEscrowed[_token] == 0`). The new deployment is the
    ///      migration target; settle in-flight projects via the normal paths
    ///      (approve / cancel / resolve) before calling.
    function migrateEscrow(address payable _newEscrow, address _token)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (_newEscrow == address(0)) revert ZeroAddress();
        if (_projectsWithShares > 0) revert VaultMigrationBlocked();
        if (totalEscrowed[_token] > 0) revert UnsettledObligations();

        uint256 amount = _token == address(0) ? address(this).balance : IERC20(_token).balanceOf(address(this));
        if (amount == 0) revert NoFunds();

        if (_token == address(0)) {
            (bool s,) = _newEscrow.call{value: amount}("");
            if (!s) revert TransferFailed();
        } else {
            IERC20(_token).safeTransfer(_newEscrow, amount);
        }
        emit EscrowMigrated(_newEscrow, _token, amount);
    }

    /// @notice Idle surplus held for `_token` (address(0) = native) — balance
    ///         beyond tracked obligations; 0 while escrow sits in the yield vault.
    function idleBalance(address _token) external view returns (uint256) {
        uint256 bal = _token == address(0) ? address(this).balance : IERC20(_token).balanceOf(address(this));
        uint256 owed = totalEscrowed[_token];
        return bal > owed ? bal - owed : 0;
    }

    function getMilestoneCount(uint256 _id) external view returns (uint256) {
        return projects[_id].milestones.length;
    }
}
