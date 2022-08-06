const Fund = artifacts.require("Fund");
const ERC721Staking = artifacts.require("ERC721Staking");
const X11 = artifacts.require("X11");
const BUSD = artifacts.require("BUSD");
const X721 = artifacts.require("X721");

module.exports = async function (deployer) {
  await deployer.deploy(X11);
  await deployer.deploy(X721);
  await deployer.deploy(BUSD);
  await deployer.deploy(ERC721Staking, X721.address, X11.address);
  await deployer.deploy(Fund, X11.address, BUSD.address, X721.address);

  const xusdInstance = await X721.deployed();
  await xusdInstance.grantRole(
    "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
    Fund.address
  );
};
