const Fund = artifacts.require("Fund");
const Token = artifacts.require("X11");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("Fund", function (accounts) {
  beforeEach(async function () {
    this.token = await Token.deployed();
    this.instance = await Fund.deployed(
      this.token.address,
      this.token.address,
      this.token.address
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

  it("should allow the user to add a stake", async function () {
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
    return assert.equal(balance.toString(), "9999994000000000000000000000");
  });
});
