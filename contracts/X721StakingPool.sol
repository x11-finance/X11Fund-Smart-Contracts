// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./X721.sol";

contract ERC721Staking is ERC721Holder, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    struct Stake {
        uint256[] tokenIds;
        uint256 since;
        uint256 balance;
        uint256 rewards;
        uint256 claimedRewards;
        address from;
    }
    mapping (address => Stake) stakes;
    mapping (uint256 => address) tokenOwner;
    uint256[] stakedTokens;
    address[] users;
    bool public tokensClaimable;
    bool initialised;
    uint256 stakingStartTime;

    X721 public stakedToken;
    IERC20 public rewardToken;
    uint256 public totalStaked;
    uint256 public x11RateToUSD;
    uint256 constant stakingTime = 1 days;
    uint256 constant token = 10e18;

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount, uint256 tokenId);
    event Unstaked(address indexed user, uint256 tokenId);
    event RewardPaid(address indexed user, uint256 reward);
    event EmergencyUnstake(address indexed user, uint256 tokenId);
    event ClaimableStatusUpdated(bool isEnabled);

    /* ========== METHODS ========== */

    constructor(address _stakedToken, address _rewardToken) {
        stakedToken = X721(_stakedToken);
        rewardToken = IERC20(_rewardToken);   
    }
    
    function initStaking() public onlyOwner {
        require(!initialised, "Already initialized");
        stakingStartTime = block.timestamp;
        initialised = true;
    }

    function setTokensClaimable(bool enabled) public onlyOwner {
        tokensClaimable = enabled;
        emit ClaimableStatusUpdated(enabled);
    }

    function getStakedTokens(address _user) public view returns (uint256[] memory tokenIds) {
        return stakes[_user].tokenIds;
    }

    function stake(uint256 tokenId) public {
        require(initialised, "The staking has not started.");
        require(stakedToken.ownerOf(tokenId) == msg.sender, "User must own the token.");

        _stake(msg.sender, tokenId);
    }

    function _stake(address _user, uint256 _tokenId) internal {
        Stake storage __stake = stakes[_user];
        __stake.tokenIds.push(_tokenId);
       
        if(__stake.tokenIds.length <= 1) {
            __stake.balance = 0;
        }
        __stake.balance += stakedToken.peggedAmount(_tokenId);
        tokenOwner[_tokenId] = _user;
        stakedToken.safeTransferFrom(_user, address(this), _tokenId);
        stakedTokens.push(_tokenId); 
        users.push(_user);
        totalStaked++;   
        emit Staked(_user, 1, _tokenId);
    }

    function unstake(uint256 _tokenId) public nonReentrant {
        claimReward(msg.sender);
        _unstake(msg.sender, _tokenId);
    }

    // Unstake without caring about rewards. EMERGENCY ONLY.
    function emergencyUnstake(uint256 _tokenId) public {
        require(
            tokenOwner[_tokenId] == msg.sender,
            "nft._unstake: Sender must have staked tokenID"
        );
        _unstake(msg.sender, _tokenId);
        emit EmergencyUnstake(msg.sender, _tokenId);
    }

    function _unstake(address _user, uint256 _tokenId) internal {
        require(tokenOwner[_tokenId] == _user, "User must own the token.");
        Stake storage __stake = stakes[_user];

        uint256 lastIndex = __stake.tokenIds.length - 1;
        uint256 lastIndexKey = __stake.tokenIds[lastIndex];

        if (__stake.tokenIds.length > 0) {
            __stake.tokenIds.pop();
        }
       
        if(__stake.balance == 0) {
            delete stakes[_user];
        }
        delete tokenOwner[_tokenId];

        stakedToken.safeTransferFrom(address(this), _user, _tokenId);
        totalStaked--;

        emit Unstaked(_user, _tokenId);

    }

    function getInvestmentTier(uint256 _tokenId) internal view returns (uint256) {
        uint256 peggedAmount = stakedToken.peggedAmount(_tokenId);
        if (peggedAmount < 5000) { 
            return uint256(5) * uint256(10e8) / uint256(365); 
        } else if (peggedAmount >= 5000 && peggedAmount < 15000) {
            return uint256(8) * uint256(10e8) / uint256(365);
        } else if (peggedAmount >= 15000 && peggedAmount < 30000) {
            return uint256(10) * uint256(10e8) / uint256(365);
        } else if (peggedAmount >= 30000 && peggedAmount < 50000) {
            return uint256(15) * uint256(10e8) / uint256(365);
        } else if (peggedAmount >= 50000 && peggedAmount < 70000) {
            return uint256(20) * uint256(10e8) / uint256(365);
        } else if (peggedAmount >= 70000) {
            return uint256(30) * uint256(10e8) / uint256(365);
        } 
        return uint256(0);
    }

    function updateReward() public onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            Stake storage __stake = stakes[users[i]];
            uint256[] storage ids = __stake.tokenIds;
            for (uint256 j = 0; j < ids.length; j++) {
                uint256 stakedDays = 30;//((block.timestamp - uint(__stake.since))) / stakingTime;
                uint256 tier = getInvestmentTier(ids[j]);
                if (j == 0) {
                    __stake.rewards = 0;
                }
                uint256 tokenRewards = stakedToken.peggedAmount(ids[j]) * stakedDays * tier * x11RateToUSD / 10e16; 
                __stake.rewards = tokenRewards; 
            }
        }
    }

    function claimReward(address _user) public returns (uint256) {
        uint256 unclaimedReward = stakes[_user].rewards - stakes[_user].claimedRewards;
        require(tokensClaimable == true, "Tokens cannnot be claimed yet");
        require(unclaimedReward > 0 , "0 rewards yet");

        stakes[_user].claimedRewards += unclaimedReward;
        //rewardToken.transferFrom(address(this), msg.sender, unclaimedReward);

        emit RewardPaid(_user, unclaimedReward);
        return unclaimedReward;
    }

    // 10e8
    function setRateToUSD(uint256 _rate) public onlyOwner {
        x11RateToUSD = _rate;
    }
}