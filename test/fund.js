const Fund = artifacts.require("Fund");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("Fund", function (/* accounts */) {
  it("should assert true", async function () {
    await Fund.deployed();
    return assert.isTrue(true);
  });
});
