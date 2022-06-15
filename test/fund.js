const Fund = artifacts.require("Fund");
const Token = artifacts.require("X11");
const BUSD = artifacts.require("X11");
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

    balance = await this.instance.GetUserBUSDBalance({ from: accounts[0] });
    balanceOfInstance = await this.busd.balanceOf(this.instance.address);

    return assert.equal(balance.toString(), "9999989000000000000000000000");
  });

  it("shouldn't allow the user to add a BUSD stake in the amount of less than 1K", async function () {
    await this.busd.approve(
      this.instance.address,
      web3.utils.toWei("5000.0", "ether"),
      { from: accounts[0] }
    );

    truffleAssert.fails(
      this.instance.addBUSDStakeInPool(0, web3.utils.toWei("5000.0", "ether"), {
        from: accounts[0],
      })
    );
  });
});
