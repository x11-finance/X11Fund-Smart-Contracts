// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/afb20119b33072da041c97ea717d3ce4417b5e01/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/afb20119b33072da041c97ea717d3ce4417b5e01/contracts/token/ERC20/IERC20.sol";
import "./X721.sol";

contract Fund is Ownable {

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
  
  IERC20 token;
  IERC20 busd;
  X721 x721;

  mapping (uint256 => Stake[]) initStakes; // poolId => Stake[]
  mapping (address => CanVote[]) canVote;

  Voting[] votings;
  Vote[] votes;
   
  Pool[] public pools;
  Stake[] busdStakes; 
  
  // utilities
  Pool _currentPool;
  Company[] _currentCompanies;
  Stake[] _currentStakes;

  /* ========== EVENTS ========== */

  event Staked(address indexed user, uint256 amount, uint256 poolIndex, uint256 indexInPool, uint256 timestamp);
  event Unstaked(address indexed user, uint256 amount, uint256 poolIndex, uint256 timestamp);
  event RevenueWithdrawn(uint256 poolIndex, uint256 timestamp);
  event PoolFunded(uint256 poolId, uint256 tokenamount);
  event RewardsUpdated();

  /* ========== METHODS ========== */
  
  constructor() {
    // TODO: change for a real token address
    token = IERC20(0x62D62D73C27E6240165ee3A97C6d1532c0dD0b42);
    busd = IERC20(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
  }

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

  /// Adds a Pool to the Fund
  /// ids and names of the companies should be of the same length
  function addPool(uint _number, string memory _name, string memory _description, string memory _companies) public onlyOwner {
    
    uint createdAt = block.timestamp;
    delete _currentCompanies;
    delete _currentStakes;

    pools.push(Pool(_number, _name, createdAt, _description, _companies, 0));
  }

  /// Returns Pool Info
  function getPoolInfo(uint _i) public view returns (Pool memory) {
    return pools[_i];
  }

  function addStakeHolderInPool(uint256 _poolId, uint256 _tokenamount) public returns(bool) {
    require(_tokenamount > GetAllowance(), "Please approve tokens before transferring.");
    require(_tokenamount >= 6000*10e18, "6000 is necessary to open the pool.");
    
    token.transfer(address(this), _tokenamount);
    initStakes[_poolId].push(Stake(msg.sender, _tokenamount, block.timestamp, _poolId, 0, 0));
    //canVote[msg.sender].push(CanVote(poolId, block.timestamp));
    emit Staked(msg.sender, _tokenamount, _poolId, initStakes[_poolId].length - 1, block.timestamp);
    return true;
  }

  /// Returns pool id or -1
  function _isHolderInPool(uint256 _poolId, address _holder) internal view returns(int256) {
    for (uint256 i = 0; i < initStakes[_poolId].length; i++) {
      if (initStakes[_poolId][i].from == _holder) {
        return int(i);
      }
    }
    return -1;
  }

  function _canVote(address _user, uint256 _poolId) internal view returns (bool) {
    for (uint256 i = 0; i < canVote[_user].length; i++) {
      if (canVote[_user][i].poolId == _poolId) {
        return true;
      }
    }
    return false;
  }

  function claimInitStakeFromPool(uint256 _poolId) public returns(bool) {
    int256 idInPool = _isHolderInPool(_poolId, msg.sender);
    
    require(idInPool >= 0, "You're not in this pool!");
    require(initStakes[_poolId][uint256(idInPool)].since + 30 days <= block.timestamp, "You can unstake in 1 month only");
    
    token.transferFrom(address(this), msg.sender, initStakes[_poolId][uint256(idInPool)].tokenamount);
    emit Unstaked(msg.sender, initStakes[_poolId][uint256(idInPool)].tokenamount, _poolId, block.timestamp);
    return true;
  }

  function addBUSDStakeInPool(uint256 _poolId, uint256 _tokenamount) public returns(bool) {
    require(_tokenamount > GetBUSDAllowance(), "Please approve tokens before transferring.");
    require(_tokenamount >= 1000*10e18, "1000 is necessary to open the pool.");
    
    busd.transfer(address(this), _tokenamount);
    // TODO: check!
    _tokenamount -= _tokenamount * 2 / 100;
    // TODO: minus 2%
    busdStakes.push(Stake(msg.sender, _tokenamount, block.timestamp, _poolId, 0, 0));
    canVote[msg.sender].push(CanVote(_poolId, block.timestamp, true));
    x721.mintNFT(msg.sender, _poolId, _tokenamount);
    emit Staked(msg.sender, _tokenamount, _poolId, initStakes[_poolId].length - 1, block.timestamp);
    return true;
  }

  function totalStakedInPool(uint256 _poolId) internal view returns (uint256) {
    uint256 totalStaked = 0;
    for (uint256 i = 0; i < busdStakes.length; i++) {
      if (busdStakes[i].poolId == _poolId) {
        totalStaked += busdStakes[i].tokenamount; 
      }
    }
    return totalStaked;
  }

  /// Call only when the contract is funded
  function updateRewards() public onlyOwner {
    for (uint256 i = 0; i < pools.length; i++) {
      uint256 totalStakedInCurrentPool = totalStakedInPool(pools[i].number);
      for (uint256 j = 0; j < busdStakes.length; j++) {
        if (busdStakes[j].poolId == pools[i].number && pools[i].funded > 0) {
          uint256 part = busdStakes[j].tokenamount * 10e8 / totalStakedInCurrentPool;
          busdStakes[j].rewards = pools[i].funded * part / 10e8;
        }
      }
    }
    emit RewardsUpdated();
  }

  /// Call only when the contract is funded
  function withdrawRewards(uint256 _poolId) public onlyOwner {
    Stake storage stake = busdStakes[0];
  
    for (uint256 i = 0; i < busdStakes.length; i++) {
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
    require(_tokenamount > GetBUSDAllowance(), "Please approve tokens before transferring.");
    
    pools[_poolId].funded += _tokenamount;
    busd.transfer(address(this), _tokenamount);
    
    emit PoolFunded(_poolId, _tokenamount);
  }

  function startVoting(uint256 _poolId) public onlyOwner {
    votings.push(Voting(_poolId, true));
  }

  function closeVoting(uint256 _poolId) public onlyOwner {
    for (uint256 i = 0; i < votings.length; i++) {
      if (votings[i].poolId == _poolId) {
        votings[i].isActive = false;
      }
    }
  }

  function closePool(uint256 _poolId) public onlyOwner {

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

  function stakersInThePool(uint256 _poolId) public view returns (uint256) {
    uint256 totalStakers = 0;
    for (uint256 i = 0; i < busdStakes.length; i++) {
      if (busdStakes[i].poolId == _poolId) {
        totalStakers++;
      }
    }
    return totalStakers;
  }

  function castVote(uint256 _poolId, bool _vote) public {
    require (_canVote(msg.sender, _poolId), "Not eligible for voting");
    votes.push(Vote(msg.sender, _poolId, _vote));
    canVote[msg.sender][_poolId].isTrue = false;
  } 
}
