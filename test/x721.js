const X721 = artifacts.require("X721");
const truffleAssert = require("truffle-assertions");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("X721", function (accounts) {
  const _name = "xUSD";
  const _symbol = "xUSD";
  const [deployerAddress, tokenHolderOneAddress, tokenHolderTwoAddress] =
    accounts;

  let correctUnlockCode = web3.utils.sha3("test"); //test is the password
  let timestampLockedFrom = Math.round(Date.now() / 1000) + 3; //lock it in 3 seconds to test unlock
  let unlockCodeHash = web3.utils.sha3(correctUnlockCode); //double hashed
  let initialTokens = 0;

  beforeEach(async function () {
    this.token = await X721.new();
  });

  it("has the correct name", async function () {
    const tokenName = await this.token.name();
    return assert.equal(tokenName, _name);
  });

  it("has the correct symbol", async function () {
    const symbol = await this.token.symbol();
    return assert.equal(symbol, _symbol);
  });

  it("is possible to mint tokens for the minter role", async function () {
    const symbol = await this.token.symbol();
    await truffleAssert.passes(this.token.mintNFT(deployerAddress, 0, 50000));
  });

  /*it("is not possible to transfer locked tokens", async function () {
    //unless we wait 4 seconds and the token will be locked
    await new Promise((res) => {
      setTimeout(res, 10000);
    });
    await truffleAssert.fails(
      this.token.transferFrom(tokenHolderTwoAddress, tokenHolderOneAddress, 0, {
        from: tokenHolderTwoAddress,
      }),
      truffleAssert.ErrorType.REVERT,
      "X721: Token locked"
    );
  });

  it("is not possible to unlock tokens for anybody else than the token holder", async function () {
    await truffleAssert.fails(
      this.token.unlockToken(correctUnlockCode, 0, { from: deployerAddress }),
      truffleAssert.ErrorType.REVERT,
      "X721: Only the Owner can unlock the Token"
    );
  });

  it("Creator can issue tokens", async function () {
    const toIssue = 2;
    const owner = accounts[0];
    await this.token.methods.issueTokens(toIssue).send({
      from: owner,
    });
    const finalBalance = await token.methods.balanceOf(accounts[0]).call();
    assert(initialTokens + toIssue == finalBalance);
  });

  it("Can burn token", async function () {
    const owner = accounts[0];
    await this.token.methods.burnToken("1").send({
      from: owner,
    });
    const finalBalance = await this.token.methods.balanceOf(accounts[0]).call();
    assert(initialTokens - 1 == finalBalance);
  });*/
});
