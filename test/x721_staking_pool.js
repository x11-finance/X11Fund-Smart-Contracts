const X721StakingPool = artifacts.require("ERC721Staking");
const X721 = artifacts.require("X721");
const X11 = artifacts.require("X11");

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

  it("should distribute rewards", async function () {
    let xUSD = await X721.deployed();
    let x11 = await X11.deployed();
    let stakingPool = await X721StakingPool.deployed(xUSD.address, x11.address);

    await stakingPool.initStaking({ from: accounts[0] });

    let tx = await xUSD.mintNFT(accounts[0], 1, 50000, {
      from: accounts[0],
    });
    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await xUSD.approve(stakingPool.address, tokenId);
    await stakingPool.stake(tokenId);

    let tokens = await stakingPool.getStakedTokens(accounts[0]);
    assert.equal(tokens[0].toString(), "1");

    await stakingPool.updateReward();
    let reward = await stakingPool.claimReward.call(accounts[0]);
    console.log("REWARD: ", reward.toString());

    return assert.isTrue(true);
  });
});
