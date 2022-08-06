// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Base64.sol";


contract X721 is ERC721Enumerable, ERC721Burnable, ERC721URIStorage, Pausable, Ownable, AccessControl { // /* ERC721Burnable, ERC721URIStorage */
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Metadata2 {
        uint256 poolId;
        uint256 amount;
    }
    mapping(uint256 => Metadata2) tokensData; // id => data
    uint256[] tokens;

    /* ========== EVENTS ========== */

    event Minted(address indexed user, uint256 poolId, uint256 amount, uint256 tokenId);

    /* ========== METHODS ========== */

    constructor() ERC721("xUSD", "xUSD") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

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
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function mintNFT(address client, uint256 poolId, uint256 amount) public returns (uint256) {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        
        _tokenIdCounter.increment();
        uint256 newItemId = _tokenIdCounter.current();
        tokensData[newItemId] = Metadata2(poolId, amount);
        tokens.push(newItemId);

        _mint(client, newItemId);
        _setTokenURI(newItemId, formatTokenURI(poolId, amount));

        emit Minted(client, poolId, amount, newItemId);
        
        return newItemId;
    }

    function formatTokenURI(uint256 _poolId, uint256 _tokenAmount) public pure returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name": "xUSD", "description": "A token representing the stake.", "attributes:" ["poolId": _poolId, "tokenAmount": _tokenAmount]}'
                            )
                        )
                    )
                )
            );
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        uint256 poolId = tokensData[tokenId].poolId;
        uint256 amount = tokensData[tokenId].amount;
        return formatTokenURI(poolId, amount);
    }
    
    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721URIStorage) {
    }

    function peggedAmount(uint256 _tokenId) public view returns (uint256) {
        return tokensData[_tokenId].amount;
    }

    function getPoolId(uint256 _tokenId) public view returns (uint256) {
        return tokensData[_tokenId].poolId;
    }

    function getBalanceInPool(uint256 _poolId) public view returns (uint256) {
        uint256 balanceInPool = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (ownerOf(tokens[i]) == msg.sender && tokensData[tokens[i]].poolId == _poolId) {
                balanceInPool += tokensData[tokens[i]].amount;
            }
        }
        return balanceInPool;
    }
}