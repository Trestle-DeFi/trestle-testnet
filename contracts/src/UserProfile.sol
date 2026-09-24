// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title UserProfile — gated profiles, verified-score attestations, weighted reviews
/// @notice Design (agreed 2026-09-24):
///  - Profile creation gated: only users who interacted with registered platform
///    contracts (`markInteracted` called by FreelancerEscrow / DigitalGoods).
///  - Reviews only between parties with a completed happy-path deal
///    (`markDealComplete`). Cancel/dispute does not qualify.
///  - Required profile field: non-empty `name`. Socials are a dynamic array.
///  - Positive = rating >= 4, negative = rating <= 3. Disputed reviews count at
///    half weight until owner resolves; upheld disputes zero the review.
///  - Composite score = equal 25% weights of passport / biometric /
///    third-party / reviews. Reviewer credibility uses non-review components
///    only (avoids circular dependency): max(1, base/25) where
///    base = (passport + biometric + thirdParty)/3.
///  - Attestations are EIP-712 signed by a single `attester` (reward-hub hot
///    key), anyone-relayed, with per-user nonce + deadline. No ORACLE_ROLE.
contract UserProfile is Ownable, EIP712 {
    using ECDSA for bytes32;

    // ───────────────────────── Types ─────────────────────────

    struct Profile {
        string name;
        string avatarURI;
        string bio;
        string location;
        string skills;
        bool exists;
    }

    struct SocialLink {
        string platform;
        string url;
    }

    struct Review {
        address reviewer;
        uint8 rating;
        string comment;
        uint256 timestamp;
        bool disputed;
        bool resolved;
        bool upheld;
    }

    struct ScoreAttestation {
        address user;
        uint8 scoreType;
        uint8 score;
        uint256 nonce;
        uint256 deadline;
    }

    // ───────────────────────── Constants ─────────────────────────

    uint256 public constant REVIEW_COOLDOWN = 1 days;
    uint256 public constant GLOBAL_REVIEW_COOLDOWN = 1 days;
    uint256 public constant MIN_TOKEN_BALANCE = 1e18;
    uint256 public constant MAX_COMMENT_LENGTH = 500;
    uint256 public constant MAX_REVIEWS_PER_DAY = 20;
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_BIO_LENGTH = 280;
    uint256 public constant MAX_SKILLS_LENGTH = 256;
    uint256 public constant MAX_LOCATION_LENGTH = 64;
    uint256 public constant MAX_SOCIAL_PLATFORM_LENGTH = 32;
    uint256 public constant MAX_SOCIAL_URL_LENGTH = 256;
    uint256 public constant MAX_SOCIALS = 8;

    uint8 public constant SCORE_PASSPORT = 0;
    uint8 public constant SCORE_BIOMETRIC = 1;
    uint8 public constant SCORE_THIRD_PARTY = 2;

    bytes32 public constant SCORE_ATTESTATION_TYPEHASH = keccak256(
        "ScoreAttestation(address user,uint8 scoreType,uint8 score,uint256 nonce,uint256 deadline)"
    );

    // ───────────────────────── State ─────────────────────────

    address public reviewToken;
    address public attester;

    mapping(address => bool) public platformContracts;
    mapping(address => bool) public hasInteracted;
    /// @dev deal completed between a and b (both directions set by hook)
    mapping(address => mapping(address => bool)) public hasCompletedDeal;

    mapping(address => Profile) private _profiles;
    mapping(address => SocialLink[]) private _socials;

    mapping(address => uint8) public passportScore;
    mapping(address => bool) public biometricVerified;
    mapping(address => uint8) public thirdPartyScore;
    mapping(address => uint256) public attestationNonce;

    mapping(address => Review[]) private _reviews;
    mapping(address => mapping(address => uint256)) public lastReviewTime;
    mapping(address => uint256) public lastGlobalReview;
    mapping(address => uint32) public positiveReviews;
    mapping(address => uint32) public negativeReviews;
    mapping(address => uint256) public reviewsReceivedToday;
    mapping(address => uint256) public lastReviewDay;

    // ───────────────────────── Events ─────────────────────────

    event ProfileCreated(address indexed user, string name);
    event ProfileUpdated(address indexed user, string name);
    event SocialAdded(address indexed user, string platform, string url);
    event SocialRemoved(address indexed user, string platform);
    event SocialUpdated(address indexed user, uint256 index, string platform, string url);
    event ReviewSubmitted(address indexed reviewer, address indexed user, uint8 rating, string comment);
    event ReviewDisputed(address indexed user, uint256 indexed reviewIndex, address indexed target);
    event ReviewDisputeResolved(address indexed user, uint256 indexed reviewIndex, bool upheld);
    event InteractionMarked(address indexed user, address indexed platform);
    event DealCompleted(address indexed a, address indexed b, address indexed platform);
    event ScoreAttested(address indexed user, uint8 scoreType, uint8 score);
    event AttesterUpdated(address indexed attester);
    event PlatformContractUpdated(address indexed platform, bool enabled);

    // ───────────────────────── Errors ─────────────────────────

    error InvalidRating();
    error SelfReview();
    error ReviewTooSoon();
    error InsufficientBalance();
    error ZeroAddress();
    error NotPlatform();
    error NotInteracted();
    error NoCompletedDeal();
    error NoProfile();
    error EmptyName();
    error NameTooLong();
    error BioTooLong();
    error SkillsTooLong();
    error LocationTooLong();
    error CommentTooLong();
    error InvalidAttestation();
    error AttestationExpired();
    error StaleNonce();
    error InvalidSignature();
    error InvalidScoreType();
    error ReviewLimitReached();
    error AlreadyDisputed();
    error NotDisputed();
    error NotDisputeTarget();
    error InvalidIndex();
    error EmptyField();
    error FieldTooLong();
    error TooManySocials();

    // ───────────────────────── Constructor ─────────────────────────

    constructor(address _reviewToken, address _attester)
        Ownable(msg.sender)
        EIP712("Trestle UserProfile", "1")
    {
        if (_reviewToken == address(0) || _attester == address(0)) revert ZeroAddress();
        reviewToken = _reviewToken;
        attester = _attester;
    }

    // ───────────────────────── Admin ─────────────────────────

    function setAttester(address _attester) external onlyOwner {
        if (_attester == address(0)) revert ZeroAddress();
        attester = _attester;
        emit AttesterUpdated(_attester);
    }

    function setPlatformContract(address _platform, bool _enabled) external onlyOwner {
        if (_platform == address(0)) revert ZeroAddress();
        platformContracts[_platform] = _enabled;
        emit PlatformContractUpdated(_platform, _enabled);
    }

    // ───────────────────────── Platform hooks ─────────────────────────

    modifier onlyPlatform() {
        if (!platformContracts[msg.sender]) revert NotPlatform();
        _;
    }

    /// @notice Called by registered platform contracts when a user performs a
    ///         meaningful action (create project / gig / listing, hire, buy…).
    function markInteracted(address user) external onlyPlatform {
        if (user == address(0)) revert ZeroAddress();
        if (!hasInteracted[user]) {
            hasInteracted[user] = true;
            emit InteractionMarked(user, msg.sender);
        }
    }

    /// @notice Called by registered platform contracts on happy-path deal
    ///         completion (all milestones approved / delivery confirmed).
    ///         Marks both directions so either party may review the other.
    function markDealComplete(address a, address b) external onlyPlatform {
        if (a == address(0) || b == address(0)) revert ZeroAddress();
        if (!hasCompletedDeal[a][b]) {
            hasCompletedDeal[a][b] = true;
            emit DealCompleted(a, b, msg.sender);
        }
        if (!hasCompletedDeal[b][a]) {
            hasCompletedDeal[b][a] = true;
            emit DealCompleted(b, a, msg.sender);
        }
    }

    // ───────────────────────── Profile ─────────────────────────

    function setProfile(
        string calldata _name,
        string calldata _avatarURI,
        string calldata _bio,
        string calldata _location,
        string calldata _skills
    ) external {
        if (!hasInteracted[msg.sender]) revert NotInteracted();
        if (bytes(_name).length == 0) revert EmptyName();
        if (bytes(_name).length > MAX_NAME_LENGTH) revert NameTooLong();
        if (bytes(_bio).length > MAX_BIO_LENGTH) revert BioTooLong();
        if (bytes(_skills).length > MAX_SKILLS_LENGTH) revert SkillsTooLong();
        if (bytes(_location).length > MAX_LOCATION_LENGTH) revert LocationTooLong();

        bool isNew = !_profiles[msg.sender].exists;
        _profiles[msg.sender] = Profile(_name, _avatarURI, _bio, _location, _skills, true);
        if (isNew) {
            emit ProfileCreated(msg.sender, _name);
        } else {
            emit ProfileUpdated(msg.sender, _name);
        }
    }

    function getProfile(address user) external view returns (Profile memory) {
        return _profiles[user];
    }

    function hasProfile(address user) external view returns (bool) {
        return _profiles[user].exists;
    }

    // ───────────────────────── Socials ─────────────────────────

    function addSocial(string calldata platform, string calldata url) external {
        if (!_profiles[msg.sender].exists) revert NoProfile();
        if (bytes(platform).length == 0 || bytes(url).length == 0) revert EmptyField();
        if (bytes(platform).length > MAX_SOCIAL_PLATFORM_LENGTH) revert FieldTooLong();
        if (bytes(url).length > MAX_SOCIAL_URL_LENGTH) revert FieldTooLong();
        if (_socials[msg.sender].length >= MAX_SOCIALS) revert TooManySocials();
        _socials[msg.sender].push(SocialLink(platform, url));
        emit SocialAdded(msg.sender, platform, url);
    }

    function removeSocial(uint256 index) external {
        SocialLink[] storage list = _socials[msg.sender];
        if (index >= list.length) revert InvalidIndex();
        SocialLink memory removed = list[index];
        list[index] = list[list.length - 1];
        list.pop();
        emit SocialRemoved(msg.sender, removed.platform);
    }

    function updateSocial(uint256 index, string calldata platform, string calldata url) external {
        SocialLink[] storage list = _socials[msg.sender];
        if (index >= list.length) revert InvalidIndex();
        if (bytes(platform).length == 0 || bytes(url).length == 0) revert EmptyField();
        if (bytes(platform).length > MAX_SOCIAL_PLATFORM_LENGTH) revert FieldTooLong();
        if (bytes(url).length > MAX_SOCIAL_URL_LENGTH) revert FieldTooLong();
        list[index] = SocialLink(platform, url);
        emit SocialUpdated(msg.sender, index, platform, url);
    }

    function getSocials(address user) external view returns (SocialLink[] memory) {
        return _socials[user];
    }

    // ───────────────────────── Attestations (EIP-712) ─────────────────────────

    /// @notice Submit a signed score attestation. Anyone may relay; the contract
    ///         recovers the signer and requires it == attester.
    function submitAttestation(ScoreAttestation calldata att, bytes calldata signature) external {
        if (block.timestamp > att.deadline) revert AttestationExpired();
        if (att.nonce != attestationNonce[att.user]) revert StaleNonce();
        if (att.score > 100) revert InvalidAttestation();
        if (att.scoreType > SCORE_THIRD_PARTY) revert InvalidScoreType();
        if (att.user == address(0)) revert ZeroAddress();

        bytes32 structHash = keccak256(
            abi.encode(SCORE_ATTESTATION_TYPEHASH, att.user, att.scoreType, att.score, att.nonce, att.deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (signer == address(0) || signer != attester) revert InvalidSignature();

        unchecked {
            attestationNonce[att.user] = att.nonce + 1;
        }

        if (att.scoreType == SCORE_PASSPORT) {
            passportScore[att.user] = att.score;
        } else if (att.scoreType == SCORE_BIOMETRIC) {
            biometricVerified[att.user] = att.score >= 50;
        } else {
            thirdPartyScore[att.user] = att.score;
        }

        emit ScoreAttested(att.user, att.scoreType, att.score);
    }

    // ───────────────────────── Reviews ─────────────────────────

    /// @notice Submit a review for `_user`. Requires:
    ///         - reviewer interacted with the platform
    ///         - a completed deal between reviewer and target
    ///         - both parties have profiles
    ///         - existing cooldowns + token balance gate
    function submitReview(address _user, uint8 _rating, string calldata _comment) external {
        if (_rating == 0 || _rating > 5) revert InvalidRating();
        if (msg.sender == _user) revert SelfReview();
        if (bytes(_comment).length > MAX_COMMENT_LENGTH) revert CommentTooLong();
        if (block.timestamp < lastReviewTime[msg.sender][_user] + REVIEW_COOLDOWN) revert ReviewTooSoon();
        if (block.timestamp < lastGlobalReview[msg.sender] + GLOBAL_REVIEW_COOLDOWN) revert ReviewTooSoon();
        if (IERC20(reviewToken).balanceOf(msg.sender) < MIN_TOKEN_BALANCE) revert InsufficientBalance();
        if (!hasInteracted[msg.sender]) revert NotInteracted();
        if (!hasCompletedDeal[msg.sender][_user]) revert NoCompletedDeal();
        if (!_profiles[msg.sender].exists) revert NoProfile();
        if (!_profiles[_user].exists) revert NoProfile();

        uint256 today = block.timestamp / 1 days;
        if (lastReviewDay[_user] != today) {
            lastReviewDay[_user] = today;
            reviewsReceivedToday[_user] = 0;
        }
        if (reviewsReceivedToday[_user] >= MAX_REVIEWS_PER_DAY) revert ReviewLimitReached();
        unchecked {
            reviewsReceivedToday[_user]++;
        }

        lastReviewTime[msg.sender][_user] = block.timestamp;
        lastGlobalReview[msg.sender] = block.timestamp;
        _reviews[_user].push(Review(msg.sender, _rating, _comment, block.timestamp, false, false, false));

        if (_rating >= 4) {
            positiveReviews[_user]++;
        } else {
            negativeReviews[_user]++;
        }

        emit ReviewSubmitted(msg.sender, _user, _rating, _comment);
    }

    /// @notice Target of a negative review may dispute it. While unresolved the
    ///         review counts at half weight.
    function disputeReview(address user, uint256 index) external {
        if (msg.sender != user) revert NotDisputeTarget();
        Review[] storage list = _reviews[user];
        if (index >= list.length) revert InvalidIndex();
        Review storage r = list[index];
        if (r.disputed) revert AlreadyDisputed();
        if (r.rating > 3) revert InvalidRating(); // only negative reviews disputable
        r.disputed = true;
        emit ReviewDisputed(user, index, msg.sender);
    }

    /// @notice Owner resolves a dispute.
    ///         upheld = true  → dispute valid, review weight zeroed.
    ///         upheld = false → dispute invalid, full weight restored.
    function resolveDispute(address user, uint256 index, bool upheld) external onlyOwner {
        Review[] storage list = _reviews[user];
        if (index >= list.length) revert InvalidIndex();
        Review storage r = list[index];
        if (!r.disputed) revert NotDisputed();
        if (r.resolved) revert AlreadyDisputed();
        r.resolved = true;
        r.upheld = upheld;
        if (upheld) {
            // Dispute upheld: review weight zeroed in reviewScore — keep the
            // cached breakdown in sync (only negative reviews are disputable).
            negativeReviews[user]--;
        }
        emit ReviewDisputeResolved(user, index, upheld);
    }

    function getReviewCount(address user) external view returns (uint256) {
        return _reviews[user].length;
    }

    function getReviews(address user, uint256 offset, uint256 limit) external view returns (Review[] memory) {
        Review[] storage all = _reviews[user];
        uint256 len = all.length;
        if (offset >= len) return new Review[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 count = end - offset;
        Review[] memory result = new Review[](count);
        for (uint256 i; i < count; i++) {
            result[i] = all[offset + i];
        }
        return result;
    }

    function getReviewBreakdown(address user) external view returns (uint32 pos, uint32 neg) {
        return (positiveReviews[user], negativeReviews[user]);
    }

    // ───────────────────────── Scores ─────────────────────────

    /// @dev Non-review components only — used for reviewer credibility so that
    ///      composite → review → composite never forms a cycle.
    function _baseScore(address user) internal view returns (uint256) {
        uint256 bio = biometricVerified[user] ? 100 : 0;
        return (uint256(passportScore[user]) + bio + uint256(thirdPartyScore[user])) / 3;
    }

    function _reviewerCredibility(address reviewer) internal view returns (uint256 cred) {
        uint256 base = _baseScore(reviewer);
        cred = base / 25;
        if (cred == 0) cred = 1;
    }

    /// @notice Weighted review score 0-100. Disputed+unresolved → half weight.
    ///         Upheld disputes are skipped entirely.
    function reviewScore(address user) public view returns (uint8) {
        Review[] storage list = _reviews[user];
        uint256 weightedSum;
        uint256 totalWeight;

        for (uint256 i; i < list.length; i++) {
            Review storage r = list[i];
            if (r.upheld) continue;

            uint256 cred = _reviewerCredibility(r.reviewer);
            uint256 weight = cred;
            if (r.disputed && !r.resolved) {
                weight = cred / 2;
                if (weight == 0) weight = 1;
            }

            weightedSum += uint256(r.rating) * weight;
            totalWeight += weight;
        }

        if (totalWeight == 0) return 0;
        // (weightedSum / totalWeight) is 1..5; scale to 0..100
        return uint8((weightedSum * 100) / (totalWeight * 5));
    }

    /// @notice Equal 25% composite: passport / biometric / third-party / reviews.
    function compositeScore(address user) external view returns (uint8) {
        uint256 passport = passportScore[user];
        uint256 bio = biometricVerified[user] ? 100 : 0;
        uint256 third = thirdPartyScore[user];
        uint256 review = reviewScore(user);
        return uint8((passport + bio + third + review) / 4);
    }

    /// @notice Progress bar 0-100:
    ///         profile fields 40% + passport 15 + biometric 15 + third-party 15 + reviews 15.
    function getProgress(address user) external view returns (uint8) {
        Profile storage p = _profiles[user];
        if (!p.exists) return 0;

        uint256 fields;
        if (bytes(p.name).length > 0) fields++;
        if (bytes(p.avatarURI).length > 0) fields++;
        if (bytes(p.bio).length > 0) fields++;
        if (bytes(p.location).length > 0) fields++;
        if (bytes(p.skills).length > 0) fields++;
        if (_socials[user].length > 0) fields++;

        uint256 profilePct = (fields * 100) / 6;
        uint256 passportPct = passportScore[user];
        uint256 bioPct = biometricVerified[user] ? 100 : 0;
        uint256 thirdPct = thirdPartyScore[user];
        uint256 reviewPct = _reviews[user].length > 0 ? reviewScore(user) : 0;

        return uint8((profilePct * 40 + passportPct * 15 + bioPct * 15 + thirdPct * 15 + reviewPct * 15) / 100);
    }
}
