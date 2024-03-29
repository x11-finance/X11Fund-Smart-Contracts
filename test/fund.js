const Fund = artifacts.require("Fund");
const Token = artifacts.require("X11");
const BUSD = artifacts.require("BUSD");
const XUSD = artifacts.require("X721");

const SECONDS_IN_DAY = 86400;

const truffleAssert = require("truffle-assertions");
const helpers = require("./helpers");

let tokenId;

/*
 * The main test file
 */
contract("Fund", function (accounts) {
  beforeEach(async function () {
    this.token = await Token.deployed();
    this.busd = await BUSD.deployed();
    this.xUSD = await XUSD.deployed();
    this.instance = await Fund.deployed(
      this.token.address,
      this.busd.address,
      this.xUSD.address
    );
    await this.xUSD.grantRole(
      "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
      this.instance.address,
      { from: accounts[0] }
    );
  });

  it("should deploy", async function () {
    return assert.isTrue(true);
  });

  it("should add a pool", async function () {
    await this.instance.addPool(
      0,
      "Pool#1",
      "Pool number one",
      "Some companies",
      "2022-07-13",
      "2022-07-30"
    );
    let pool = await this.instance.getPoolInfo(0);

    await this.instance.addPool(
      1,
      "Pool#2",
      "Pool number two",
      "Companies again",
      "2022-07-30",
      "2022-08-30"
    );

    let totalPools = await this.instance.getTotalPools();
    assert.equal(totalPools.toString(), "2");

    return assert.equal(pool.name, "Pool#1");
  });

  it("shouldn't add a pool with non-deployer", async function () {
    await truffleAssert.reverts(
      this.instance.addPool(
        2,
        "Pool#1",
        "Pool number one",
        "Some companies",
        "2022-07-13",
        "2022-07-30",
        { from: accounts[1] }
      )
    );
  });

  it("should not allow to add an init stake without approval", async function () {
    truffleAssert.reverts(
      this.instance.addStakeHolderInPool(
        0,
        web3.utils.toWei("6000.0", "ether"),
        { from: accounts[0] }
      )
    );
  });

  it("should not allow to add an init stake of less than 6000 X11", async function () {
    await this.token.approve(
      this.instance.address,
      web3.utils.toWei("3000.0", "ether"),
      { from: accounts[0] }
    );
    truffleAssert.reverts(
      this.instance.addStakeHolderInPool(
        0,
        web3.utils.toWei("3000.0", "ether"),
        { from: accounts[0] }
      )
    );
  });

  it("should allow the user to add an init stake", async function () {
    let balance = await this.token.balanceOf(accounts[0]);

    await this.token.approve(
      this.instance.address,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );

    let res = await this.instance.addStakeHolderInPool(
      0,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );
    balance = await this.token.balanceOf(accounts[0]);
    balanceOfInstance = await this.token.balanceOf(this.instance.address);
    assert.equal(balanceOfInstance.toString(), "6000000000000000000000");
    return assert.equal(balance.toString(), "9999994000000000000000000000");
  });

  it("should not allow to add init stake twice", async function () {
    await this.token.approve(
      this.instance.address,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );
    await truffleAssert.reverts(
      this.instance.addStakeHolderInPool(
        0,
        web3.utils.toWei("6000.0", "ether"),
        { from: accounts[0] }
      )
    );
  });

  it("should allow the user to add an init stake in another pool", async function () {
    let balance = await this.token.balanceOf(accounts[0]);

    await this.token.approve(
      this.instance.address,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );

    let res = await this.instance.addStakeHolderInPool(
      1,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );
    balance = await this.token.balanceOf(accounts[0]);
    balanceOfInstance = await this.token.balanceOf(this.instance.address);
    assert.equal(balanceOfInstance.toString(), "12000000000000000000000");
    return assert.equal(balance.toString(), "9999988000000000000000000000");
  });

  it("shouldn't allow to withdraw init stake until a month has passed", async function () {
    let idInPool = await this.instance.isHolderInPool(0, accounts[0]);
    truffleAssert.fails(this.instance.claimInitStakeFromPool(0, idInPool));
  });

  it("should not allow to withdraw init stake from wrong address", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];
    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);
    let idInPool = await this.instance.isHolderInPool(0, accounts[0]);
    await truffleAssert.reverts(
      this.instance.claimInitStakeFromPool(0, idInPool, { from: accounts[1] })
    );
    await helpers.revertToSnapShot(snapshotId);
  });

  it("should allow to withdraw init stake after a month has passed", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];
    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);
    let idInPool = await this.instance.isHolderInPool(0, accounts[0]);
    let balance = await this.token.balanceOf(accounts[0]);
    await this.instance.claimInitStakeFromPool(0, idInPool);
    let newBalance = await this.token.balanceOf(accounts[0]);

    await helpers.revertToSnapShot(snapshotId);

    assert.equal(newBalance.toString(), "9999994000000000000000000000");
  });

  it("should not allow the user to add a BUSD stake without approval", async function () {
    truffleAssert.reverts(
      this.instance.addBUSDStakeInPool(0, web3.utils.toWei("5000.0", "ether"), {
        from: accounts[0],
      })
    );
  });

  it("should not allow to add a BUSD stake smaller than 1000 BUSD", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("500.0", "ether"),
      { from: accounts[0] }
    );
    truffleAssert.reverts(
      this.instance.addBUSDStakeInPool(0, web3.utils.toWei("500.0", "ether"), {
        from: accounts[0],
      })
    );
  });

  it("should allow the user to add a BUSD stake", async function () {
    let balance = await this.busd.balanceOf(accounts[0]);

    this.instance.setAdminWallet(accounts[1]);
    this.instance.setFeeWallet(accounts[2]);
    this.instance.setFundWallet(accounts[3]);

    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );
    let allowance = await this.instance.GetBUSDAllowance();

    let res = await this.instance.addBUSDStakeInPool(
      0,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );

    tokenId = res.logs[0].args.tokenId;

    balance = await this.instance.GetUserBUSDBalance({ from: accounts[0] });
    let balanceOfInstance = await this.busd.balanceOf(this.instance.address);

    balanceAdmin = await this.instance.GetUserBUSDBalance({
      from: accounts[1],
    });

    balanceFee = await this.instance.GetUserBUSDBalance({
      from: accounts[2],
    });

    assert.equal(balanceAdmin, "4900000000000000000000");
    assert.equal(balanceFee, "100000000000000000000");
    return assert.equal(balance.toString(), "9999995000000000000000000000");
  });

  it("should allow the user to add a BUSD stake in another pool", async function () {
    let balance = await this.busd.balanceOf(accounts[0]);

    this.instance.setAdminWallet(accounts[1]);
    this.instance.setFeeWallet(accounts[2]);

    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );
    let allowance = await this.instance.GetBUSDAllowance();

    let res = await this.instance.addBUSDStakeInPool(
      1,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );

    balance = await this.instance.GetUserBUSDBalance({ from: accounts[0] });
    let balanceOfInstance = await this.busd.balanceOf(this.instance.address);

    balanceAdmin = await this.instance.GetUserBUSDBalance({
      from: accounts[1],
    });

    balanceFee = await this.instance.GetUserBUSDBalance({
      from: accounts[2],
    });

    assert.equal(balanceAdmin, "9800000000000000000000");
    assert.equal(balanceFee, "200000000000000000000");
    return assert.equal(balance.toString(), "9999990000000000000000000000");
  });

  it("shouldn't allow to add a BUSD stake before init stake", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[2] }
    );
    await truffleAssert.reverts(
      this.instance.addBUSDStakeInPool(0, web3.utils.toWei("5000.0", "ether"), {
        from: accounts[2],
      })
    );
  });

  it("should not withraw reward if the pool is not funded", async function () {
    await truffleAssert.reverts(
      this.instance.withdrawBUSDRewardWithToken(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should not close the pool if it is not funded", async function () {
    let totalBUSDStakes = await this.instance.getTotalBUSDStakes();
    let totalBUSDStaked = await this.instance.getTotalStakedInPool(0);

    await truffleAssert.reverts(
      this.instance.closePool(0, totalBUSDStakes, totalBUSDStaked)
    );
  });

  it("should not fund a pool without approval", async function () {
    await truffleAssert.reverts(
      this.instance.fundPool(0, web3.utils.toWei("5000.0", "ether"), {
        from: accounts[0],
      })
    );
  });

  it("should fund the pool", async function () {
    let unfunded = await this.busd.balanceOf(this.instance.address);
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("10000.0", "ether"),
      { from: accounts[0] }
    );
    await this.instance.fundPool(0, web3.utils.toWei("10000.0", "ether"), {
      from: accounts[0],
    });
    let funded = await this.busd.balanceOf(this.instance.address);
    let diff = funded - unfunded;
    return assert.equal(diff, web3.utils.toWei("6000.0", "ether"));
  });

  it("should not withdraw reward if the address is wrong", async function () {
    await truffleAssert.reverts(
      this.instance.withdrawBUSDRewardWithToken(tokenId, {
        from: accounts[1],
      })
    );
  });

  it("should calculate, update and distribute the rewards", async function () {
    let balanceBefore = await this.busd.balanceOf(accounts[0]);

    // await this.instance.updateReward(tokenId);
    await this.instance.ApproveBUSD(
      web3.utils.toWei("1000000000000000.0", "ether")
    );

    await this.instance.withdrawBUSDRewardWithToken(tokenId, {
      from: accounts[0],
    });
    let balanceAfter = await this.busd.balanceOf(accounts[0]);
    let diff = balanceAfter.sub(balanceBefore);

    return assert.equal(
      diff.toString(),
      web3.utils.toWei("6000.0", "ether").toString()
    );
  });

  it("shouldn't allow the user to add a BUSD stake in the amount of less than 1K", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );

    truffleAssert.fails(
      this.instance.addBUSDStakeInPool(0, web3.utils.toWei("500.0", "ether"), {
        from: accounts[0],
      })
    );
  });

  it("should correctly calculate how much is staked in pool", async function () {
    let balance = await this.instance.getTotalStakedInPool(0);
    return assert.equal(balance.toString(), "4900000000000000000000");
  });

  it("should correctly calculate how much is invested in all pools", async function () {
    let total = await this.instance.getTotalInvestment();
    return assert.equal(total.toString(), "9800000000000000000000");
  });

  it("should count how much stakers in the pool", async function () {
    let count = await this.instance.getStakersInThePool(0);
    return assert.equal(count.toString(), "1");
  });

  it("should trace the holder in a pool", async function () {
    let holder = await this.instance.isHolderInPool(0, accounts[0]);
    let holder2 = await this.instance.isHolderInPool(0, accounts[1]);
    assert.equal(holder2, -1);
    return assert.equal(holder.toString(), 0);
  });

  it("should count total BUSD stakes", async function () {
    let count = await this.instance.getTotalBUSDStakes();
    return assert.equal(count.toString(), 2);
  });

  it("should count total init [X11] stakes", async function () {
    let count = await this.instance.getTotalInitStakes();
    return assert.equal(count.toString(), 2);
  });

  it("should not emergency withdraw if the pool is not funded", async function () {
    await truffleAssert.reverts(
      this.instance.emergencyWithdrawRewardsToAdmin()
    );
  });

  it("should emergency wihdraw funds to Admin", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("10000.0", "ether"),
      { from: accounts[0] }
    );
    await this.instance.fundPool(0, web3.utils.toWei("10000.0", "ether"));
    let balanceBefore = await this.busd.balanceOf(accounts[0]);
    await this.instance.emergencyWithdrawRewardsToAdmin();
    let balanceAfter = await this.busd.balanceOf(accounts[0]);
    let diff = balanceAfter.sub(balanceBefore);

    return assert.equal(diff.toString(), "6000000000000000000000");
  });

  it("should close the pool[0]", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("10000.0", "ether"),
      { from: accounts[0] }
    );
    await this.instance.fundPool(0, web3.utils.toWei("10000.0", "ether"));
    let totalBUSDStakes = await this.instance.getTotalBUSDStakes();
    let totalBUSDStaked = await this.instance.getTotalStakedInPool(0);
    let res = await this.instance.closePool(
      0,
      totalBUSDStakes,
      totalBUSDStaked
    );
    let poolInfo = await this.instance.getPoolInfo(0);

    return assert.equal(poolInfo.isActive, false);
  });

  it("shouldn't allow to add a BUSD stake in the closed pool", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );
    await truffleAssert.reverts(
      this.instance.addBUSDStakeInPool(0, web3.utils.toWei("5000.0", "ether"), {
        from: accounts[0],
      })
    );
  });

  it("shouldn't allow to add a init stake in the closed pool", async function () {
    await this.token.approve(
      this.instance.address,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );

    await truffleAssert.reverts(
      this.instance.addStakeHolderInPool(
        0,
        web3.utils.toWei("6000.0", "ether"),
        { from: accounts[0] }
      )
    );
  });

  it("shouldn't allow to add an init stake into non-existent pool", async function () {
    await this.token.approve(
      this.instance.address,
      web3.utils.toWei("6000.0", "ether"),
      { from: accounts[0] }
    );

    await truffleAssert.reverts(
      this.instance.addStakeHolderInPool(
        5,
        web3.utils.toWei("6000.0", "ether"),
        { from: accounts[0] }
      )
    );
  });

  it("shouldn't allow to withdraw a BUSD stake in the closed pool", async function () {
    await truffleAssert.reverts(
      this.instance.withdrawBUSDRewardWithToken(tokenId, { from: accounts[0] })
    );
  });

  it("shouldn't allow to withdraw an init stake in the closed pool", async function () {
    let idInPool = await this.instance.isHolderInPool(0, accounts[0]);
    await truffleAssert.reverts(
      this.instance.claimInitStakeFromPool(0, idInPool)
    );
  });

  it("should not allow to claim init stake from another pool", async function () {
    await truffleAssert.fails(this.instance.claimInitStakeFromPool(0, -1));
  });
});
