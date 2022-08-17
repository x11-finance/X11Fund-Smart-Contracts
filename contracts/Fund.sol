// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./X721.sol";

contract Fund is Ownable, ReentrancyGuard {
  struct Company{
    string index;
    string name;
  }

  struct Stake {
    address from;
    uint256 tokenamount;
    uint256 since;
    uint256 poolId;
    uint256 rewards;
    uint256 claimedRewards;
  }

  mapping (address => mapping(uint256 => bool)) staker;

  struct BUSDStake {
    address from;
    uint256 tokenamount;
    uint256 since;
    uint256 poolId;
    uint256 rewards;
    uint256 claimedRewards;
    uint256 tokenId;
  }

  struct Pool {
    uint256 number;
    string name;
    uint256 startedAt;
    string description;
    string companies;
    uint256 funded;
    bool isActive;
    string setStarts;
    string setEnds;
  }

  struct Vote {
    address from;
    uint256 poolId;
    bool vote;
  }

  struct Voting {
    uint256 poolId;
    bool isActive;
  }

  struct CanVote {
    uint256 poolId;
    uint256 since;
    bool isTrue;
  }
  
  uint256 internal constant initStakePeriod = 30 days;

  IERC20 public token;
  IERC20 busd;
  X721 x721;

  mapping (uint256 => Stake[]) initStakes; // poolId => Stake[]
  mapping (address => CanVote[]) canVote;

  uint256 totalInitStakes = 0;

  mapping (uint256 => uint256) stakersInThePool;
  mapping (uint256 => uint256) stakedInThePool;

  Voting[] votings;
  Vote[] votes;
   
  Pool[] public pools;
  BUSDStake[] busdStakes; 

  uint256 totalInvestments;

  address adminWallet;
  address fundFeeWallet;

  /* ========== EVENTS ========== */

  event Staked(address indexed user, uint256 amount, uint256 poolIndex, uint256 indexInPool, uint256 timestamp);
  event StakedInit(address indexed user, uint256 amount, uint256 poolIndex, uint256 indexInPool, uint256 timestamp);
  event Unstaked(address indexed user, uint256 amount, uint256 poolIndex, uint256 timestamp);
  event UnstakedInit(address indexed user, uint256 amount, uint256 poolIndex, uint256 timestamp);
  event EmergencyWithdrawn(uint256 poolIndex, uint256 timestamp);
  event RevenueWithdrawn(uint256 poolIndex, uint256 timestamp, address to, uint256 tokenId);
  event PoolFunded(uint256 poolId, uint256 tokenamount);
  event RewardsUpdated();

  /* ========== METHODS ========== */
  
  constructor(address _token, address _busd, address _x721) {
    token = IERC20(_token);
    busd = IERC20(_busd);
    x721 = X721(_x721);
    adminWallet = 0xCA04E3fF4bfC69C02f6DAe8B21Ff2C045312941A;
    fundFeeWallet = 0x1D0D90a4EA47dA82D4E9C32Ce942b376a0F4adb7;
  }

  /// Adds a Pool to the Fund
  /// ids and names of the companies should be of the same length
  function addPool(uint _number, string memory _name, string memory _description, string memory _companies, string memory _setStarts, string memory _setEnds) public onlyOwner {
    uint createdAt = block.timestamp;
    pools.push(Pool(_number, _name, createdAt, _description, _companies, 0, true, _setStarts, _setEnds));
  }

  /// Returns Pool Info
  function getPoolInfo(uint _i) public view returns (Pool memory) {
    return pools[_i];
  }

  /// Returns Pool Info
  function getPoolInfoAdmin(uint _i) public view onlyOwner returns (Pool memory) {
    return pools[_i];
  }

  function addStakeHolderInPool(uint256 _poolId, uint256 _tokenamount) public returns(bool) {
    require(_tokenamount <= GetAllowance(), "Please approve tokens before transferring.");
    require(_tokenamount >= 6000000000000000000000, "6000 is necessary to open the pool.");
    require(staker[msg.sender][_poolId] == false, "You've already staked in this pool.");
    return _addStakeHolderInPool(_poolId, _tokenamount);
  }

  function _addStakeHolderInPool(uint256 _poolId, uint256 _tokenamount) internal returns(bool) {
    initStakes[_poolId].push(Stake(msg.sender, _tokenamount, block.timestamp, _poolId, 0, 0));
    totalInitStakes++;
    staker[msg.sender][_poolId] = true;
    token.transferFrom(msg.sender, address(this), _tokenamount);
    emit StakedInit(msg.sender, _tokenamount, _poolId, initStakes[_poolId].length - 1, block.timestamp);
    return true;
  }

  function claimInitStakeFromPool(uint256 _poolId, uint256 _idInPool) public returns(bool) {
    require(_idInPool >= 0, "You're not in this pool!");
    require(initStakes[_poolId][uint256(_idInPool)].since + initStakePeriod <= block.timestamp, "You can unstake in 1 month only");
    require(initStakes[_poolId][uint256(_idInPool)].from == msg.sender);
    require(initStakes[_poolId][uint256(_idInPool)].claimedRewards == 0);

    return _claimInitStakeFromPool(_poolId, _idInPool);
  }

  function _claimInitStakeFromPool(uint256 _poolId, uint256 _idInPool) internal returns(bool) {
    initStakes[_poolId][uint256(_idInPool)].claimedRewards = initStakes[_poolId][uint256(_idInPool)].tokenamount;
    token.transfer(initStakes[_poolId][uint256(_idInPool)].from, initStakes[_poolId][uint256(_idInPool)].tokenamount);
    emit UnstakedInit(msg.sender, initStakes[_poolId][uint256(_idInPool)].tokenamount, _poolId, block.timestamp);
    return true;
  }

  function addBUSDStakeInPool(uint256 _poolId, uint256 _tokenamount) public returns(bool) {
    require(_tokenamount <= GetBUSDAllowance(), "Please approve tokens before transferring.");
    require(_tokenamount >= 1000000000000000000000, "1000 is necessary to open the pool.");
    require(pools[_poolId].isActive, "The pool is killed.");
    
    return _addBUSDStakeInPool(_poolId, _tokenamount);
  }

  function _addBUSDStakeInPool(uint256 _poolId, uint256 _tokenamount) internal returns(bool) {
    busd.transferFrom(msg.sender, address(this), _tokenamount);
    uint256 fee = _tokenamount * 2 / 100;
    uint256 tokenamount = _tokenamount - fee;
    busd.approve(address(this), tokenamount + fee);
    busd.approve(fundFeeWallet, fee);
    busd.approve(adminWallet, tokenamount);
    busd.transferFrom(address(this), fundFeeWallet, fee);
    busd.transferFrom(address(this), adminWallet, tokenamount);
    canVote[msg.sender].push(CanVote(_poolId, block.timestamp, true));
    uint256 tokenId = x721.mintNFT(msg.sender, _poolId, _tokenamount);
    busdStakes.push(BUSDStake(msg.sender, tokenamount, block.timestamp, _poolId, 0, 0, tokenId));
    stakersInThePool[_poolId]++;
    stakedInThePool[_poolId] += tokenamount;
    totalInvestments += tokenamount; 
    emit Staked(msg.sender, tokenamount, _poolId, initStakes[_poolId].length - 1, block.timestamp);
    return true;
  }

  function withdrawBUSDRewardWithToken(uint256 _tokenId, uint256 _poolId, uint256 _idInHeap) public nonReentrant {
    require(pools[_poolId].funded >= 0);
    require(x721.ownerOf(_tokenId) == msg.sender);

    uint256 unclaimedReward = busdStakes[_idInHeap].rewards - busdStakes[_idInHeap].claimedRewards;
    busdStakes[_idInHeap].claimedRewards += unclaimedReward;

    busd.transfer(busdStakes[_idInHeap].from, unclaimedReward);

    emit RevenueWithdrawn(_poolId, block.timestamp, msg.sender, _tokenId);
  }

  function getVotes(uint256 _poolId) public view returns (uint256) {
    uint256 totalVotes = 0;
    for (uint256 i = 0; i < votes.length; i++) {
      if (votes[i].poolId == _poolId && votes[i].vote) {
        totalVotes++;
      }
    }
    return totalVotes;
  }

  function castVote(uint256 _poolId, bool _vote, uint256 _tokenId) public {
    require (_canVote(msg.sender, _poolId), "Not eligible for voting");
    require (votings[_poolId].isActive, "Voting finished");
    require (x721.getPoolId(_tokenId) == _poolId);
    require (x721.ownerOf(_tokenId) == msg.sender);

    _castVote(_poolId, _vote);
  } 

  function _castVote(uint256 _poolId, bool _vote) internal {
    votes.push(Vote(msg.sender, _poolId, _vote));
    canVote[msg.sender][_poolId].isTrue = false;
  }

  /* ========== ADMIN METHODS ========== */

  function setAdminWallet(address _wallet) public onlyOwner {
    adminWallet = _wallet;
  }

  function setFeeWallet(address _wallet) public onlyOwner {
    fundFeeWallet = _wallet;
  }

  /// Call only when the contract is funded
  function updateRewards(uint256 _poolsAmount, uint256 _from, uint256 _to) public {
    uint256 to;
    for (uint256 i = 0; i < _poolsAmount; i++) {
      if (pools[i].funded == 0) {
        continue;
      }
      uint256 totalStakedInCurrentPool = stakedInThePool[pools[i].number];
      if (_to > busdStakes.length) {
        to = busdStakes.length;
      } else {
        to = _to;
      }
      for (uint256 j = _from; j < to; j++) {
        if (busdStakes[j].poolId == pools[i].number && pools[i].funded > 0) {
          uint256 part = busdStakes[j].tokenamount * 10e8 / totalStakedInCurrentPool;
          busdStakes[j].rewards = pools[i].funded * part / 10e8;
        }
      }
    }
    emit RewardsUpdated();
  }

  /// Call only when the pool is funded
  function emergencyWithdrawRewardsToAll(uint256 _poolId, uint256 _busdStakesAmount) public onlyOwner {
    require(pools[_poolId].funded >= 0);

    for (uint256 i = 0; i < _busdStakesAmount; i++) {
      if (busdStakes[i].poolId == _poolId) {
        uint256 unclaimedReward = busdStakes[i].rewards - busdStakes[i].claimedRewards;
        busdStakes[i].claimedRewards += unclaimedReward;
        busd.transferFrom(address(this), busdStakes[i].from, unclaimedReward);
      }
    }
    pools[_poolId].funded = 0;
    emit EmergencyWithdrawn(_poolId, block.timestamp);
  }

  /// Call only when the pool is funded
  function emergencyWithdrawRewardsToAdmin(uint256 _poolId, uint256 _busdStakesAmount) public onlyOwner {
    require(pools[_poolId].funded >= 0);

    for (uint256 i = 0; i < _busdStakesAmount; i++) {
      if (busdStakes[i].poolId == _poolId) {
        uint256 unclaimedReward = busdStakes[i].rewards - busdStakes[i].claimedRewards;
        busdStakes[i].claimedRewards += unclaimedReward;
        busd.transferFrom(address(this), msg.sender, unclaimedReward);
      }
    }
    pools[_poolId].funded = 0;
    emit EmergencyWithdrawn(_poolId, block.timestamp);
  }

  /// Fund pool with BUSD
  function fundPool(uint256 _poolId, uint256 _tokenamount) public onlyOwner {
    require(_tokenamount <= GetBUSDAllowance(), "Please approve tokens before transferring.");
    _fundPool(_poolId, _tokenamount);
  }

  function _fundPool(uint256 _poolId, uint256 _tokenamount) internal {
    pools[_poolId].funded += _tokenamount;
    busd.transferFrom(msg.sender, address(this), _tokenamount);
    
    emit PoolFunded(_poolId, _tokenamount);
  }

  function startVoting(uint256 _poolId) public onlyOwner {
    votings.push(Voting(_poolId, true));
  }

  function closeVoting(uint256 _poolId, uint256 _votingsAmount) public onlyOwner {
    for (uint256 i = 0; i < _votingsAmount; i++) {
      if (votings[i].poolId == _poolId) {
        votings[i].isActive = false;
      }
    }
  }

  function closePool(uint256 _poolId, uint256 _busdStakesAmount, uint256 _totalStakedInPool) public onlyOwner {
    require(pools[_poolId].funded > 0, "Please fund the pool first.");
 
    for (uint256 i = 0; i < _busdStakesAmount; i++) {
      if (busdStakes[i].poolId == _poolId) {
        busdStakes[i].tokenamount -= 2 * busdStakes[i].tokenamount / 100;
        uint256 part = busdStakes[i].tokenamount * 10e8 / _totalStakedInPool;
        uint256 cashout = pools[i].funded * part / 10e8;
        busd.transferFrom(address(this), busdStakes[i].from, cashout);
      }
    }

    pools[_poolId].isActive = false;
  }

  /* ========== HELPER VIEW METHODS ========== */

  function getTotalPools() public view returns (uint256) {
    return pools.length;
  }

  function getTotalInitStakes() public view returns (uint256) {
    return totalInitStakes;
  }

  function getTotalBUSDStakes() public view returns (uint256) {
    return busdStakes.length;
  }

  function getVotingsAmount() public view returns (uint256) {
    return votings.length;
  }

  function getVotesAmount() public view returns (uint256) {
    return votes.length;
  }

  function _canVote(address _user, uint256 _poolId) public view returns (bool) {
    for (uint256 i = 0; i < canVote[_user].length; i++) {
      if (canVote[_user][i].poolId == _poolId) {
        return true;
      }
    }
    return false;
  }

  /// Returns pool id or -1
  function isHolderInPool(uint256 _poolId, address _holder) public view returns(int256) {
    for (uint256 i = 0; i < initStakes[_poolId].length; i++) {
      if (initStakes[_poolId][i].from == _holder) {
        return int(i);
      }
    }
    return -1;
  }

  /// Returns pool id or -1
  function isTokenInPool(uint256 _poolId, uint256 _tokenId) public view returns(int256) {
    for (uint256 i = 0; i < busdStakes.length; i++) {
      if (busdStakes[i].tokenId == _tokenId) {
        return int(i);
      }
    }
    return -1;
  }

  function getTotalStakedInPool(uint256 _poolId) public view returns (uint256) {
    return stakedInThePool[_poolId];
  }

  function getStakersInThePool(uint256 _poolId) public view returns (uint256) {
    return stakersInThePool[_poolId];
  }

  function getTotalInvestment() public view returns (uint256) {
    return totalInvestments;
  }

  /* ========== UTILITY METHODS ========== */

  function GetUserTokenBalance() public view returns(uint256) { 
    return token.balanceOf(msg.sender);
  } 
   
  function ApproveTokens(uint256 _tokenamount) public returns(bool) {
    token.approve(address(this), _tokenamount);
    return true;
  }
   
  function GetAllowance() public view returns(uint256) {
    return token.allowance(msg.sender, address(this));
  }
    
  function GetContractTokenBalance() public onlyOwner view returns(uint256) {
    return token.balanceOf(address(this));
  }

  function GetUserBUSDBalance() public view returns(uint256) { 
    return busd.balanceOf(msg.sender);
  } 
   
  function ApproveBUSD(uint256 _tokenamount) public returns(bool) {
    busd.approve(address(this), _tokenamount);
    return true;
  }
   
  function GetBUSDAllowance() public view returns(uint256) {
    return busd.allowance(msg.sender, address(this));
  }
    
  function GetContractBUSDBalance() public onlyOwner view returns(uint256) {
    return busd.balanceOf(address(this));
  }

}