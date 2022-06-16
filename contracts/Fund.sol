// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./X721.sol";

contract Fund is Ownable {
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

  struct Pool {
    uint256 number;
    string name;
    uint256 startedAt;
    string description;
    string companies;
    uint256 funded;
    bool isActive;
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
  
  IERC20 public token;
  IERC20 busd;
  X721 x721;

  mapping (uint256 => Stake[]) initStakes; // poolId => Stake[]
  mapping (address => CanVote[]) canVote;

  Voting[] votings;
  Vote[] votes;
   
  Pool[] public pools;
  Stake[] busdStakes; 

  /* ========== EVENTS ========== */

  event Staked(address indexed user, uint256 amount, uint256 poolIndex, uint256 indexInPool, uint256 timestamp);
  event Unstaked(address indexed user, uint256 amount, uint256 poolIndex, uint256 timestamp);
  event RevenueWithdrawn(uint256 poolIndex, uint256 timestamp);
  event PoolFunded(uint256 poolId, uint256 tokenamount);
  event RewardsUpdated();

  /* ========== METHODS ========== */
  
  constructor(address _token, address _busd, address _x721) {
    token = IERC20(_token);
    busd = IERC20(_busd);
    x721 = X721(_x721);
  }

  /// Adds a Pool to the Fund
  /// ids and names of the companies should be of the same length
  function addPool(uint _number, string memory _name, string memory _description, string memory _companies) public onlyOwner {
    uint createdAt = block.timestamp;
    pools.push(Pool(_number, _name, createdAt, _description, _companies, 0, true));
  }

  /// Returns Pool Info
  function getPoolInfo(uint _i) public view returns (Pool memory) {
    return pools[_i];
  }

  function addStakeHolderInPool(uint256 _poolId, uint256 _tokenamount) public returns(bool) {
    require(_tokenamount <= GetAllowance(), "Please approve tokens before transferring.");
    require(_tokenamount >= 6000, "6000 is necessary to open the pool.");
    return _addStakeHolderInPool(_poolId, _tokenamount);
  }

  function _addStakeHolderInPool(uint256 _poolId, uint256 _tokenamount) internal returns(bool) {
    initStakes[_poolId].push(Stake(msg.sender, _tokenamount, block.timestamp, _poolId, 0, 0));
    token.transferFrom(msg.sender, address(this), _tokenamount);
    emit Staked(msg.sender, _tokenamount, _poolId, initStakes[_poolId].length - 1, block.timestamp);
    return true;
  }

  function claimInitStakeFromPool(uint256 _poolId, uint256 _idInPool) public returns(bool) {
    require(_idInPool >= 0, "You're not in this pool!");
    require(initStakes[_poolId][uint256(_idInPool)].since + 30 days <= block.timestamp, "You can unstake in 1 month only");
   
    return _claimInitStakeFromPool(_poolId, _idInPool);
  }

  function _claimInitStakeFromPool(uint256 _poolId, uint256 _idInPool) internal returns(bool) {
    token.transferFrom(address(this), initStakes[_poolId][uint256(_idInPool)].from, initStakes[_poolId][uint256(_idInPool)].tokenamount);
    emit Unstaked(msg.sender, initStakes[_poolId][uint256(_idInPool)].tokenamount, _poolId, block.timestamp);
    return true;
  }

  function addBUSDStakeInPool(uint256 _poolId, uint256 _tokenamount) public returns(bool) {
    require(_tokenamount <= GetBUSDAllowance(), "Please approve tokens before transferring.");
    require(_tokenamount >= 1000, "1000 is necessary to open the pool.");
    require(pools[_poolId].isActive, "The pool is killed.");
    
    return _addBUSDStakeInPool(_poolId, _tokenamount);
  }

  function _addBUSDStakeInPool(uint256 _poolId, uint256 _tokenamount) internal returns(bool) {
    busd.transferFrom(msg.sender, address(this), _tokenamount);
    busdStakes.push(Stake(msg.sender, _tokenamount, block.timestamp, _poolId, 0, 0));
    canVote[msg.sender].push(CanVote(_poolId, block.timestamp, true));
    x721.mintNFT(msg.sender, _poolId, _tokenamount);
    emit Staked(msg.sender, _tokenamount, _poolId, initStakes[_poolId].length - 1, block.timestamp);
    return true;
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

  function castVote(uint256 _poolId, bool _vote) public {
    require (_canVote(msg.sender, _poolId), "Not eligible for voting");
    require (votings[_poolId].isActive, "Voting finished");
    _castVote(_poolId, _vote);
  } 

  function _castVote(uint256 _poolId, bool _vote) internal {
    votes.push(Vote(msg.sender, _poolId, _vote));
    canVote[msg.sender][_poolId].isTrue = false;
  }

  /* ========== ADMIN METHODS ========== */

  /// Call only when the contract is funded
  function updateRewards(uint256 _poolsAmount, uint256 _busdStakesAmount) public onlyOwner {
    for (uint256 i = 0; i < _poolsAmount; i++) {
      uint256 totalStakedInCurrentPool = totalStakedInPool(pools[i].number);
      for (uint256 j = 0; j < _busdStakesAmount; j++) {
        if (busdStakes[j].poolId == pools[i].number && pools[i].funded > 0) {
          uint256 part = busdStakes[j].tokenamount * 10e8 / totalStakedInCurrentPool;
          busdStakes[j].rewards = pools[i].funded * part / 10e8;
        }
      }
    }
    emit RewardsUpdated();
  }

  /// Call only when the contract is funded
  function withdrawRewards(uint256 _poolId, uint256 _busdStakesAmount) public onlyOwner {
    Stake storage stake = busdStakes[0];
  
    for (uint256 i = 0; i < _busdStakesAmount; i++) {
      if (busdStakes[i].poolId == _poolId) {
        uint256 unclaimedReward = stake.rewards - stake.claimedRewards;
        stake.claimedRewards += unclaimedReward;
        busd.transferFrom(address(this), busdStakes[i].from, unclaimedReward);
      }
    }
    pools[_poolId].funded = 0;
    emit RevenueWithdrawn(_poolId, block.timestamp);
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
    uint256 result = 0;
    for (uint256 i = 0; i < pools.length; i++) {
      result += initStakes[i].length;
    }
    return result;
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

  function totalStakedInPool(uint256 _poolId) public view returns (uint256) {
    uint256 totalStaked = 0;
    for (uint256 i = 0; i < busdStakes.length; i++) {
      if (busdStakes[i].poolId == _poolId) {
        totalStaked += busdStakes[i].tokenamount; 
      }
    }
    return totalStaked;
  }

  function stakersInThePool(uint256 _poolId) public view returns (uint256) {
    uint256 totalStakers = 0;
    for (uint256 i = 0; i < busdStakes.length; i++) {
      if (busdStakes[i].poolId == _poolId) {
        totalStakers++;
      }
    }
    return totalStakers;
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
