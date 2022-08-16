const Fund = artifacts.require("Fund");
const X721StakingPool = artifacts.require("ERC721Staking");
const X721 = artifacts.require("X721");
const X11 = artifacts.require("X11");
const BUSD = artifacts.require("BUSD");
const XUSD = artifacts.require("X721");

const truffleAssert = require("truffle-assertions");

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
  });

  it("should deploy", async function () {
    return assert.isTrue(true);
  });

  it("should set the correct rate", async function () {
    await this.pool.setRateToUSD(web3.utils.toWei("10.0", "ether"), {
      from: accounts[0],
    });
    let rate = await this.pool.x11RateToUSD();
    return assert.equal(rate.toString(), "10000000000000000000");
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

  it("should accept the stake", async function () {
    await this.pool.initStaking({ from: accounts[0] });
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

  it("should not allow non-owner to withdraw stake", async function () {
    this.pool.setTokensClaimable(true, { from: accounts[0] });
    truffleAssert.fails(this.pool.unstake(1, { from: accounts[1] }));
  });

  it("should distribute rewards", async function () {
    await this.pool.setTokensClaimable(true, { from: accounts[0] });

    let tx = await this.xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.xUSD.approve(this.pool.address, tokenId);
    await this.pool.stake(tokenId);

    let tokens = await this.pool.getStakedTokens(accounts[0]);
    assert.equal(tokens[0].toString(), "2");

    await this.pool.updateReward(accounts[0]);
    let reward = await this.pool.claimReward.call(accounts[0]);

    return assert.equal("5265753372000000000", reward.toString());
  });
});
