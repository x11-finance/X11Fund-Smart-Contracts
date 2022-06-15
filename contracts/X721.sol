// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract X721 is ERC721, ERC721Enumerable, Pausable, Ownable, ERC721Burnable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    struct Metadata2 {
        uint256 poolId;
        uint256 amount;
    }
    mapping(uint256 => Metadata2) tokensData;

    constructor() ERC721("xUSD", "xUSD") {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function safeMint(address to) public onlyOwner {
        require(1 == 10, "Doesn't work with this token.");
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function mintNFT(address client, uint256 poolId, uint256 amount) public onlyOwner returns (uint256) {
        _tokenIdCounter.increment();

        uint256 newItemId = _tokenIdCounter.current();
        _mint(client, newItemId);

        tokensData[newItemId] = Metadata2(poolId, amount);

        return newItemId;
    }

    function peggedAmount(uint256 _tokenId) public view returns (uint256) {
        return tokensData[_tokenId].amount;
    }

    function getPoolId(uint256 _tokenId) public view returns (uint256) {
        return tokensData[_tokenId].poolId;
    }
}