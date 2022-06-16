const Fund = artifacts.require("Fund");
const ERC721Staking = artifacts.require("ERC721Staking");
const X11 = artifacts.require("X11");
const BUSD = artifacts.require("BUSD");
const X721 = artifacts.require("X721");

module.exports = async function (deployer) {
  await deployer.deploy(X11);
  await deployer.deploy(X721);
  await deployer.deploy(BUSD);
  await deployer.deploy(ERC721Staking);
  await deployer.deploy(Fund, X11.address, BUSD.address, X721.address);
};
