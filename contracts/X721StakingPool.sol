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

/**
 * @title ERC721Staking
 * @dev ERC721Staking is a contract for staking ERC721 tokens.
 */
contract ERC721Staking is ERC721Holder, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    struct Stake {
        uint256[] tokenIds;
        uint256[] since;
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

    /**
     * @dev Initialises the contract
     * @param _stakedToken The address of the staked token
     * @param _rewardToken The address of the reward token
     */
    constructor(address _stakedToken, address _rewardToken) {
        stakedToken = X721(_stakedToken);
        rewardToken = IERC20(_rewardToken);   
    }
    
    /**
     * @dev Initialises the staking
     */
    function initStaking() public onlyOwner {
        require(!initialised, "Already initialized");
        stakingStartTime = block.timestamp;
        initialised = true;
    }

    /**
     * @dev Updates the claimable status
     * @param _isEnabled The status of the claimability
     */
    function setTokensClaimable(bool _isEnabled) public onlyOwner {
        tokensClaimable = _isEnabled;
        emit ClaimableStatusUpdated(_isEnabled);
    }

    /**
     * @dev Returns the staked tokens of a user
     * @param _user The address of the user
     * @return tokenIds staked tokens of the user (array)
     */
    function getStakedTokens(address _user) public view returns (uint256[] memory tokenIds) {
        return stakes[_user].tokenIds;
    }

    /**
     * @dev Returns the owner of the staked token
     * @param _tokenId The id of the token
     * @return owner The address of the user
     */
    function getStakedTokenOwner(uint256 _tokenId) public view returns (address owner) {
        return tokenOwner[_tokenId];
    }

    /**
     * @dev Performs the stake
     * @param _tokenId The address of the user
     */
    function stake(uint256 _tokenId) public {
        require(initialised, "The staking has not started.");
        require(stakedToken.ownerOf(_tokenId) == msg.sender, "User must own the token.");

        _stake(msg.sender, _tokenId);
    }

    /**
     * @dev Internal stake logic
     * @param _user The address of the user
     * @param _tokenId The id of the token
     */
    function _stake(address _user, uint256 _tokenId) internal {
        Stake storage __stake = stakes[_user];
        __stake.tokenIds.push(_tokenId);
        __stake.since.push(block.timestamp);
       
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

    /**
     * @dev Performs the unstake
     * @param _tokenId The id of the token
     */
    function unstake(uint256 _tokenId) public nonReentrant {
        claimReward(msg.sender);
        _unstake(msg.sender, _tokenId);
    }

    /**
     * @dev Unstake without caring about rewards. EMERGENCY ONLY.
     * @param _tokenId The id of the token
     */
    function emergencyUnstake(uint256 _tokenId) public {
        require(
            tokenOwner[_tokenId] == msg.sender,
            "nft._unstake: Sender must have staked tokenID"
        );
        _unstake(msg.sender, _tokenId);
        emit EmergencyUnstake(msg.sender, _tokenId);
    }

    /**
     * @dev Internal unstake logic
     * @param _user The address of the user
     * @param _tokenId The id of the token
     */
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

    /*
    * @dev Returns the daily reward percentage for a token
    * @param _tokenId The id of the token
    * @return The daily reward percentage
    */
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

    /**
     * @dev Calculates the reward for a user
     * @param _user The address of the user
     */
    function updateReward(address _user) public {
        Stake storage __stake = stakes[_user];
        uint256[] storage ids = __stake.tokenIds;
        for (uint256 j = 0; j < ids.length; j++) {
            uint256 stakedDays = ((block.timestamp - uint(__stake.since[j]))) / stakingTime;
            uint256 tier = getInvestmentTier(ids[j]);
            if (j == 0) {
                __stake.rewards = 0;
            }
            uint256 tokenRewards = stakedToken.peggedAmount(ids[j]) * stakedDays 
                * tier * 10e18 * 10e7 / (x11RateToUSD * 100); 
            __stake.rewards += tokenRewards; 
        }
    }

    /**
     * @dev Returns the reward for a user
     * @param _user The address of the user
     */
    function getReward(address _user) public view returns (uint256) {
        Stake storage __stake = stakes[_user];
        return __stake.rewards;
    }
    
    /** 
     * @dev Claim reward for the user
     * @param _user Address of the user
     * @return reward Amount of reward claimed
     */
    function claimReward(address _user) public returns (uint256) {
        uint256 unclaimedReward = stakes[_user].rewards - stakes[_user].claimedRewards;
        require(tokensClaimable == true, "Tokens cannnot be claimed yet");
        require(unclaimedReward > 0 , "0 rewards yet");
        require(rewardToken.balanceOf(address(this)) >= unclaimedReward, "Not enough tokens in the contract");
        require(_user == msg.sender, "User must be the same as msg.sender");
        require(rewardToken.transfer(_user, unclaimedReward), "Transfer failed");

        stakes[_user].claimedRewards += unclaimedReward;

        emit RewardPaid(_user, unclaimedReward);
        return unclaimedReward;
    }

    /**
     * @dev Sets the rate of X11 to USD
     * @param _rate The rate of X11 to USD
     */
    function setRateToUSD(uint256 _rate) public onlyOwner {
        x11RateToUSD = _rate;
    }
}