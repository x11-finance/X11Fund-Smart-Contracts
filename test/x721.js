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
    await truffleAssert.passes(
      this.token.mintNFT(deployerAddress, 0, 10000, { from: accounts[0] })
    );
  });

  it("can trace the token contents", async function () {
    let tx = await this.token.mintNFT(deployerAddress, 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    let peggedAmount = await this.token.peggedAmount(tokenId);
    let poolId = await this.token.getPoolId(tokenId);

    assert.equal(peggedAmount.toString(), "50000");
    assert.equal(poolId.toString(), "1");
  });
});
