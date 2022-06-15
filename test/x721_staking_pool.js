const X721StakingPool = artifacts.require("ERC721Staking");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("ERC721Staking", function (accounts) {
  it("should deploy", async function () {
    await X721StakingPool.deployed();
    return assert.isTrue(true);
  });

  it("should set the correct rate", async function () {
    let stakingPool = await X721StakingPool.deployed();
    await stakingPool.setRateToUSD(web3.utils.toWei("10.0", "ether"), {
      from: accounts[0],
    });
    let rate = await stakingPool.x11RateToUSD();
    return assert.equal(rate.toString(), "10000000000000000000");
  });
});
