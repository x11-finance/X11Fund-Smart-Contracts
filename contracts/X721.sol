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

    /**
     * @dev Initialises the contract
     */
    constructor() ERC721("xUSD", "xUSD") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Puts minting on pause
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses minting
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    // SHOULD NOT BE USED
    function safeMint(address to) public onlyOwner {
        require(1 == 10, "Doesn't work with this token.");
    }

    // The following function is override required by Solidity.
    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following function is override required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Mints a new token
     * @param _client The address of the token owner
     * @param _poolId The id of the pool
     * @param _amount The amount of the token
     */
    function mintNFT(address _client, uint256 _poolId, uint256 _amount) public returns (uint256) {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        
        _tokenIdCounter.increment();
        uint256 newItemId = _tokenIdCounter.current();
        tokensData[newItemId] = Metadata2(_poolId, _amount);
        tokens.push(newItemId);

        _mint(_client, newItemId);
        _setTokenURI(newItemId, formatTokenURI(_poolId, _amount));

        emit Minted(_client, _poolId, _amount, newItemId);
        
        return newItemId;
    }

    /**
     * @dev Formats the token URI
     * @param _poolId The id of the pool
     * @param _tokenAmount The amount of the token
     */
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

    /**
     * @dev Formats the token URI
     * @param _poolId The id of the pool
     * @param _amount The amount of the token
     */
    function formatTokenURI2(uint256 _poolId, uint256 _amount) public pure returns (string memory) {
        string memory json = Base64.encode(bytes(string(abi.encodePacked('{"name": "xUSD #', _poolId, '", "description": "xUSD is a tokenized stablecoin that represents the value of USD. It is backed by a basket of stablecoins and can be redeemed for USD at any time.", "image": "https://xusd.finance/images/xUSD.png", "attributes": [{"trait_type": "Pool ID", "value": "', _poolId, '"}, {"trait_type": "Amount", "value": "', _amount, '"}] }'))));
        string memory output = string(abi.encodePacked('data:application/json;base64,', json));
        return output;
    }

    /**
     * @dev Returns the token URI
     * @param _tokenId The id of the token
     */
    function tokenURI(uint256 _tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        uint256 poolId = tokensData[_tokenId].poolId;
        uint256 amount = tokensData[_tokenId].amount;
        return formatTokenURI(poolId, amount);
    }
    
    // tokens are not burnable in this contract
    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721URIStorage) {
    }

    /**
     * @dev Returns the amount of investments for a given token 
     * @param _tokenId The id of the token
     */
    function peggedAmount(uint256 _tokenId) public view returns (uint256) {
        return tokensData[_tokenId].amount;
    }

    /**
     * @dev Returns the pool id for a given token 
     * @param _tokenId The id of the token
     */
    function getPoolId(uint256 _tokenId) public view returns (uint256) {
        return tokensData[_tokenId].poolId;
    }

    /**
     * @dev Returns user balance in the pool
     * @param _poolId The id of the pool
     */
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