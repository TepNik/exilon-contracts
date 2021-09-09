// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Test is ERC20 {
    // solhint-disable-next-line func-visibility no-empty-blocks
    constructor() ERC20("Test", "TEST") {}

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
