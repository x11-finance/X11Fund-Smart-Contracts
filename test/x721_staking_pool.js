const Fund = artifacts.require("Fund");
const X721StakingPool = artifacts.require("ERC721Staking");
const X721 = artifacts.require("X721");
const X11 = artifacts.require("X11");
const BUSD = artifacts.require("BUSD");
const XUSD = artifacts.require("X721");

const SECONDS_IN_DAY = 86400;

const truffleAssert = require("truffle-assertions");
const helpers = require("./helpers");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("ERC721Staking", function (accounts) {
  beforeEach(async function () {
    this.token = await X11.deployed();
    this.busd = await BUSD.deployed();
    this.xUSD = await XUSD.deployed();
    this.fund = await Fund.deployed(
      this.token.address,
      this.busd.address,
      this.xUSD.address
    );
    this.pool = await X721StakingPool.deployed();

    await this.xUSD.grantRole(
      "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
      this.fund.address,
      { from: accounts[0] }
    );
  });

  it("should deploy", async function () {
    return assert.isTrue(true);
  });

  it("should set the correct rate", async function () {
    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    let rate = await this.pool.x11RateToUSD();
    return assert.equal(rate.toString(), "1000000000000000000");
  });

  it("shouldn't accept the stake before staking is started", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await truffleAssert.reverts(
      this.pool.stake(tokenId, {
        from: accounts[0],
      }),
      "The staking has not started."
    );
  });

  it("should not accept the stake if the user is not the owner of the token", async function () {
    await this.pool.initStaking();

    let tx = await this.xUSD.mintNFT(accounts[1], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await truffleAssert.reverts(
      this.pool.stake(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should not initiliaze the staking twice", async function () {
    await truffleAssert.reverts(this.pool.initStaking());
  });

  it("should accept the stake", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    truffleAssert.passes(
      this.pool.stake(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should not allow to claim reward if there is not enough tokens in the contract", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[3], 1, 20000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[3] });
    await this.pool.stake(tokenId, { from: accounts[3] });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    await this.pool.updateReward(tokenId, { from: accounts[3] });

    await this.token.transfer(accounts[1], web3.utils.toWei("100", "ether"), {
      from: accounts[0],
    });

    await truffleAssert.reverts(
      this.pool.claimReward(tokenId, {
        from: accounts[3],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("should not allow to claim reward from another address", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[3], 1, 20000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[3] });
    await this.pool.stake(tokenId, { from: accounts[3] });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    await this.pool.updateReward(tokenId, { from: accounts[3] });

    await truffleAssert.reverts(
      this.pool.claimReward(tokenId, {
        from: accounts[1],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("shouldn't allow to withdraw stake and rewards until tokens are set claimable", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    await truffleAssert.reverts(
      this.pool.unstake(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should allow to emergency withdraw stake without carrying about the rewards", async function () {
    await this.token.approve(
      accounts[0],
      web3.utils.toWei("1000000.0", "ether"),
      {
        from: accounts[0],
      }
    );
    await this.token.transferFrom(
      accounts[0],
      this.pool.address,
      web3.utils.toWei("1000000.0", "ether"),
      { from: accounts[0] }
    );

    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    await truffleAssert.passes(
      this.pool.emergencyUnstake(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should not allow to emergency unstake twice", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    await this.pool.emergencyUnstake(tokenId, {
      from: accounts[0],
    });

    await truffleAssert.reverts(
      this.pool.emergencyUnstake(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should not allow to emergency unstake from another address", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    await truffleAssert.reverts(
      this.pool.emergencyUnstake(tokenId, {
        from: accounts[1],
      })
    );
  });

  it("should allow to withdraw stake and rewards after tokens are set claimable", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    await this.token.approve(
      accounts[0],
      web3.utils.toWei("1000000.0", "ether"),
      {
        from: accounts[0],
      }
    );
    await this.token.transferFrom(
      accounts[0],
      this.pool.address,
      web3.utils.toWei("1000000.0", "ether"),
      { from: accounts[0] }
    );

    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setTokensClaimable(true, { from: accounts[0] });
    await this.pool.updateReward(tokenId, { from: accounts[0] });

    await truffleAssert.passes(
      this.pool.unstake(tokenId, {
        from: accounts[0],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("shouldn't allow to withdraw stake twice", async function () {
    const snapshot = await helpers.takeSnapshot();
    const snapshotId = snapshot["result"];

    await this.token.approve(
      accounts[0],
      web3.utils.toWei("1000000.0", "ether"),
      {
        from: accounts[0],
      }
    );
    await this.token.transferFrom(
      accounts[0],
      this.pool.address,
      web3.utils.toWei("1000000.0", "ether"),
      { from: accounts[0] }
    );

    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setTokensClaimable(true, { from: accounts[0] });
    await this.pool.updateReward(tokenId, { from: accounts[0] });

    await this.pool.unstake(tokenId, {
      from: accounts[0],
    });

    await truffleAssert.reverts(
      this.pool.unstake(tokenId, {
        from: accounts[0],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("should allow one person to stake more than once", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    let tx2 = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs: logs2 } = tx2;
    const tokenId2 = logs2[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId2);
    await truffleAssert.passes(
      this.pool.stake(tokenId2, {
        from: accounts[0],
      })
    );
  });

  it("should not accept the stake without approval", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    truffleAssert.fails(
      this.pool.stake(tokenId, {
        from: accounts[0],
      })
    );
  });

  it("should return the owner of the staked token", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId, {
      from: accounts[0],
    });

    const owner = await this.pool.getStakedTokenOwner(tokenId);

    return assert.equal(owner, accounts[0]);
  });

  it("should not allow non-owner to withdraw stake", async function () {
    this.pool.setTokensClaimable(true, { from: accounts[0] });
    truffleAssert.fails(this.pool.unstake(1, { from: accounts[1] }));
  });

  it("should distribute rewards", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[3], 1, 20000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[3] });
    await this.pool.stake(tokenId, { from: accounts[3] });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    await this.pool.updateReward(tokenId, { from: accounts[3] });

    let reward = await this.pool.getReward(tokenId);

    const txn = await this.pool.claimReward(tokenId, {
      from: accounts[3],
    });
    const balance3 = await this.token.balanceOf(accounts[3]);
    const contractBalance = await this.token.balanceOf(this.pool.address);

    await helpers.revertToSnapShot(snapshotId);

    assert.equal(balance3.toString(), reward.toString());
    return assert.equal("164.38356", web3.utils.fromWei(reward, "ether"));
  });

  it("should not allow to claim reward if the reward is 0", async function () {
    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[3], 1, 20000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[3] });
    await this.pool.stake(tokenId, { from: accounts[3] });

    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    await this.pool.updateReward(tokenId, { from: accounts[3] });

    await truffleAssert.reverts(
      this.pool.claimReward(tokenId, {
        from: accounts[3],
      })
    );
  });

  it("should not allow to claim reward from another address", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[3], 1, 20000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[3] });
    await this.pool.stake(tokenId, { from: accounts[3] });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    await this.pool.updateReward(tokenId, { from: accounts[3] });

    let reward = await this.pool.getReward(tokenId);

    await truffleAssert.reverts(
      this.pool.claimReward(tokenId, {
        from: accounts[1],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("should not allow to claim if the tokens are not claimable", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    await this.pool.setTokensClaimable(false, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[3], 1, 20000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[3] });
    await this.pool.stake(tokenId, { from: accounts[3] });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setRateToUSD(web3.utils.toWei("1.0", "ether"), {
      from: accounts[0],
    });
    await this.pool.updateReward(tokenId, { from: accounts[3] });

    await truffleAssert.reverts(
      this.pool.claimReward(tokenId, {
        from: accounts[3],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("should return the proper investment tier for a given token", async function () {
    let tx = await this.xUSD.mintNFT(accounts[0], 1, 3000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    let tier = await this.pool.getInvestmentTier(tokenId);

    assert.equal(tier.toString(), "13698630");

    let tx2 = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs: logs2 } = tx2;
    const tokenId2 = logs2[1].args.tokenId;

    let tier2 = await this.pool.getInvestmentTier(tokenId2);

    assert.equal(tier2.toString(), "54794520");

    let tx3 = await this.xUSD.mintNFT(accounts[0], 1, 10000, {
      from: accounts[0],
    });
    const { logs: logs3 } = tx3;
    const tokenId3 = logs3[1].args.tokenId;

    let tier3 = await this.pool.getInvestmentTier(tokenId3);

    assert.equal(tier3.toString(), "21917808");

    let tx4 = await this.xUSD.mintNFT(accounts[0], 1, 20000, {
      from: accounts[0],
    });
    const { logs: logs4 } = tx4;
    const tokenId4 = logs4[1].args.tokenId;

    let tier4 = await this.pool.getInvestmentTier(tokenId4);

    assert.equal(tier4.toString(), "27397260");

    let tx5 = await this.xUSD.mintNFT(accounts[0], 1, 35000, {
      from: accounts[0],
    });
    const { logs: logs5 } = tx5;
    const tokenId5 = logs5[1].args.tokenId;

    let tier5 = await this.pool.getInvestmentTier(tokenId5);

    assert.equal(tier5.toString(), "41095890");

    let tx6 = await this.xUSD.mintNFT(accounts[0], 1, 70000, {
      from: accounts[0],
    });
    const { logs: logs6 } = tx6;
    const tokenId6 = logs6[1].args.tokenId;

    let tier6 = await this.pool.getInvestmentTier(tokenId6);

    assert.equal(tier6.toString(), "82191780");
  });

  it("should allow to withdraw stake and then destroy the stake object", async function () {
    const snapShot = await helpers.takeSnapshot();
    const snapshotId = snapShot["result"];

    let tx = await this.xUSD.mintNFT(accounts[1], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[1] });
    await this.pool.stake(tokenId, {
      from: accounts[1],
    });

    await helpers.advanceTimeAndBlock(SECONDS_IN_DAY * 30);

    await this.pool.setTokensClaimable(true, { from: accounts[0] });
    await this.pool.updateReward(accounts[0]);

    await truffleAssert.passes(
      this.pool.emergencyUnstake(tokenId, {
        from: accounts[1],
      })
    );

    await helpers.revertToSnapShot(snapshotId);
  });

  it("should set tokensClaimable to false", async function () {
    await this.pool.setTokensClaimable(false, { from: accounts[0] });
    let claimable = await this.pool.tokensClaimable();
    assert.equal(claimable, false);
  });

  it("should return the correct token id", async function () {
    let tx = await this.xUSD.mintNFT(accounts[1], 0, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId, { from: accounts[1] });
    await this.pool.stake(tokenId, {
      from: accounts[1],
    });

    let id = await this.pool.getTokenId(accounts[1], 0);
    assert.equal(id.toString(), tokenId.toString());
  });
});
