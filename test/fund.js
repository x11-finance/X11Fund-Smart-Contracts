const Fund = artifacts.require("Fund");
const Token = artifacts.require("X11");
const BUSD = artifacts.require("BUSD");
const XUSD = artifacts.require("X721");

const truffleAssert = require("truffle-assertions");

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
      "Some companies"
    );
    let pool = await this.instance.getPoolInfo(0);
    return assert.equal(pool.name, "Pool#1");
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

  it("shouldn't allow to withdraw init stake until a month has passed", async function () {
    let idInPool = await this.instance.isHolderInPool(0, accounts[0]);
    truffleAssert.fails(this.instance.claimInitStakeFromPool(0, idInPool));
  });

  it("should allow the user to add a BUSD stake", async function () {
    let balance = await this.busd.balanceOf(accounts[0]);
    //console.log(balance.toString());

    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("10000.0", "ether"),
      { from: accounts[0] }
    );
    let allowance = await this.instance.GetBUSDAllowance();

    let res = await this.instance.addBUSDStakeInPool(
      0,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );

    balance = await this.instance.GetUserBUSDBalance({ from: accounts[0] });
    let balanceOfInstance = await this.busd.balanceOf(this.instance.address);
    //console.log(balance.toString());

    let canvote = await this.instance.getTotalBUSDStakes();
    //console.log("Stakes: ", canvote.toString());

    return assert.equal(balance.toString(), "9999995000000000000000000000");
  });

  it("should allow members to vote", async function () {
    await this.instance.startVoting(0, { from: accounts[0] });
    await this.instance.castVote(0, true, { from: accounts[0] });

    let votes = await this.instance.getVotes(0);

    return assert.equal(votes.toNumber(), 1);
  });

  it("shouldn't allow non-members to vote", async function () {
    return truffleAssert.fails(
      this.instance.castVote(0, true, { from: accounts[1] })
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
    return assert.equal(diff, web3.utils.toWei("10000.0", "ether"));
  });

  it("shouldn't allow members to vote when the voting is closed", async function () {
    let votingsAmount = await this.instance.getVotingsAmount();
    await this.instance.closeVoting(0, votingsAmount, { from: accounts[0] });
    //return assert.isTrue(true);
    truffleAssert.fails(this.instance.castVote(0, true, { from: accounts[0] }));
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
});
