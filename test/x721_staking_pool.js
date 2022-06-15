const X721StakingPool = artifacts.require("ERC721Staking");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("ERC721Staking", function (accounts) {
  it("should assert true", async function () {
    await X721StakingPool.deployed();
    return assert.isTrue(2 > 1);
  });
});
