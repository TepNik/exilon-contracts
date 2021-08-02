// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WethReceiver {
    address public immutable exilonToken;

    // solhint-disable-next-line func-visibility
    constructor(address _exilonToken) {
        exilonToken = _exilonToken;
    }

    function getWeth(address weth, uint256 amount) external {
        address _exilonToken = exilonToken;
        require(msg.sender == _exilonToken, "wethReceiver: Not allowed");
        IERC20(weth).transfer(_exilonToken, amount);
    }
}
