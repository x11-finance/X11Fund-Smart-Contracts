const X721 = artifacts.require("X721");
const truffleAssert = require("truffle-assertions");
2;

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

  it("is not possible to mint tokens for non-minter role", async function () {
    await truffleAssert.fails(
      this.token.mintNFT(deployerAddress, 0, 10000, { from: accounts[1] })
    );
  });

  it("is possible to transfer tokens for the owner role", async function () {
    const tx = await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });
    const tokenId = tx.logs[0].args.tokenId;
    await truffleAssert.passes(
      this.token.transferFrom(deployerAddress, tokenHolderOneAddress, tokenId, {
        from: accounts[0],
      })
    );
  });

  it("is not possible to transfer tokens for non-owner role", async function () {
    const tx = await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });
    const tokenId = tx.logs[0].args.tokenId;
    await truffleAssert.fails(
      this.token.transferFrom(deployerAddress, tokenHolderOneAddress, tokenId, {
        from: accounts[1],
      })
    );
  });

  it("is possible to burn tokens for the owner role", async function () {
    const tx = await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });
    const tokenId = tx.logs[0].args.tokenId;
    await truffleAssert.passes(this.token.burn(tokenId, { from: accounts[0] }));
  });

  it("is not possible to burn tokens for non-owner role", async function () {
    const tx = await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });
    const tokenId = tx.logs[0].args.tokenId;
    await truffleAssert.reverts(
      this.token.burn(tokenId, { from: accounts[1] })
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
    return assert.equal(poolId.toString(), "1");
  });

  it("can trace the owner", async function () {
    await this.token.mintNFT(deployerAddress, 0, 20000, {
      from: accounts[0],
    });
    let tx = await this.token.mintNFT(deployerAddress, 1, 30000, {
      from: accounts[0],
    });

    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    const balance = await this.token.balanceOf(accounts[0]);
    const owner = await this.token.ownerOf(tokenId);

    // const balanceXUSD = await this.token.getBalanceInPool(0);

    assert.equal(balance.toNumber(), 2);
    // assert.equal(balanceXUSD, 20000);
    return assert.equal(owner, accounts[0]);
  });

  it("can transfer tokens between users", async function () {
    await this.token.mintNFT(deployerAddress, 0, 20000, {
      from: accounts[0],
    });
    let tx = await this.token.mintNFT(deployerAddress, 1, 30000, {
      from: accounts[0],
    });

    const { logs } = tx;
    const tokenId = logs[1].args.tokenId;

    await this.token.transferFrom(accounts[0], accounts[1], tokenId, {
      from: accounts[0],
    });

    const balance = await this.token.balanceOf(accounts[1]);
    const owner = await this.token.ownerOf(tokenId);

    assert.equal(balance.toNumber(), 1);
    return assert.equal(owner, accounts[1]);
  });

  it("should return the correct token URI", async function () {
    const tx = await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });
    const tokenId = tx.logs[0].args.tokenId;
    const tokenURI = await this.token.tokenURI(tokenId);

    return assert.equal(
      tokenURI,
      "data:application/json;base64,eyJuYW1lIjogInhVU0QiLCAiZGVzY3JpcHRpb24iOiAiQSB0b2tlbiByZXByZXNlbnRpbmcgdGhlIHN0YWtlLiIsICJhdHRyaWJ1dGVzOiIgWyJwb29sSWQiOjAidG9rZW5BbW91bnQiOjEwMDAwXX0="
    );
  });

  it("should support the ERC721Enumerable interface", async function () {
    await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });
    await this.token.mintNFT(deployerAddress, 0, 10000, {
      from: accounts[0],
    });

    const totalSupply = await this.token.totalSupply();
    const tokenByIndex = await this.token.tokenByIndex(0);
    const tokenOfOwnerByIndex = await this.token.tokenOfOwnerByIndex(
      deployerAddress,
      0
    );

    assert.equal(totalSupply.toNumber(), 2);
    assert.equal(tokenByIndex.toNumber(), 2);
    return assert.equal(tokenOfOwnerByIndex.toNumber(), 2);
  });

  it("should support the parent interfaces", async function () {
    const supportsERC165 = await this.token.supportsInterface("0x01ffc9a7");
    const supportsERC721 = await this.token.supportsInterface("0x80ac58cd");
    const supportsERC721Enumerable = await this.token.supportsInterface(
      "0x780e9d63"
    );

    assert.equal(supportsERC165, true);
    assert.equal(supportsERC721, true);
    return assert.equal(supportsERC721Enumerable, true);
  });
});
