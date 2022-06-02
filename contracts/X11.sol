// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract X11 is ERC20 {
  constructor() public ERC20("X11 Token", "X11") {
    _mint(msg.sender, 1000000000);
  }
}
