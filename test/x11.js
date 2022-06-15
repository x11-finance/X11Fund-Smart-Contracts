const X11 = artifacts.require("X11");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("X11", function (accounts) {
  const _name = "X11 Token";
  const _symbol = "X11";
  const _decimals = 18;

  beforeEach(async function () {
    this.token = await X11.new();
  });

  it("has the correct name", async function () {
    const tokenName = await this.token.name();
    return assert.equal(tokenName, _name);
  });

  it("has the correct symbol", async function () {
    const symbol = await this.token.symbol();
    return assert.equal(symbol, _symbol);
  });

  it("has the correct decimals", async function () {
    const decimals = await this.token.decimals();
    return assert.equal(decimals.toNumber(), _decimals);
  });

  it("should return the balance of token owner", async function () {
    const balance = await this.token.balanceOf.call(accounts[0]);
    assert.equal(
      balance.toString(),
      "10000000000000000000000000000",
      "balance is wrong"
    );
  });

  it("should transfer right token", async function () {
    await this.token.transfer(accounts[1], 50000);
    const balance0 = await this.token.balanceOf.call(accounts[0]);
    const balance1 = await this.token.balanceOf.call(accounts[1]);
    assert.equal(balance1.toNumber(), 50000, "accounts[1] balance is wrong");
  });

  it("should give accounts[1] authority to spend account[0]'s token", async function () {
    await this.token.approve(accounts[1], 200000);
    const allowance = await this.token.allowance.call(accounts[0], accounts[1]);
    assert.equal(allowance.toNumber(), 200000, "allowance is wrong");
    await this.token.transferFrom(accounts[0], accounts[2], 200000, {
      from: accounts[1],
    });
    const balance0 = await this.token.balanceOf.call(accounts[0]);
    const balance1 = await this.token.balanceOf.call(accounts[1]);
    const balance2 = await this.token.balanceOf.call(accounts[2]);

    assert.equal(balance2.toNumber(), 200000, "accounts[2] balance is wrong");
  });
});
