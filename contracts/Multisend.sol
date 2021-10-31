// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Multisend {
    function multisendEth(address[] calldata users, uint256[] calldata amounts) external payable {
        require(msg.value > 0, "Multisend: No value");
        require(users.length > 0, "Multisend: No users");
        require(users.length == amounts.length, "Multisend: Wrong length");

        uint256 restAmount = msg.value;
        uint256 len = users.length;
        for (uint256 i = 0; i < len; ++i) {
            uint256 amountToUser = amounts[i];
            restAmount -= amountToUser;

            (bool success, ) = users[i].call{value: amountToUser}("");
            require(success, "Multisend: Eth send if failed");
        }
        require(restAmount == 0, "Multisend: Amount error");
    }

    function multisendToken(
        address token,
        address[] calldata users,
        uint256[] calldata amounts
    ) external {
        require(users.length > 0, "Multisend: No users");
        require(users.length == users.length, "Multisend: Wrong length");

        uint256 len = users.length;
        for (uint256 i = 0; i < len; ++i) {
            uint256 amountToUser = amounts[i];

            require(
                IERC20(token).transferFrom(msg.sender, users[i], amountToUser),
                "Multisend: Transfer failed"
            );
        }
    }
}
