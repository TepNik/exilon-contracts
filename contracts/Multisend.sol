// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Multisend {
    function multisendEth(address[] calldata users) external payable {
        require(msg.value > 0, "Multisend: No value");
        require(users.length > 0, "Multisend: No users");

        uint256 totalValue = msg.value;
        uint256 restAmount = totalValue;
        uint256 len = users.length;
        for(uint256 i = 0; i < len; ++i) {
            uint256 amountToUser;
            if (i < len - 1) {
                amountToUser = totalValue / len;
                restAmount -= amountToUser;
            } else {
                amountToUser = restAmount;
            }

            (bool success, ) = users[i].call{ value: amountToUser }("");
            require(success, "Multisend: Eth send if failed");
        }
    }

    function multisendToken(address token, address[] calldata users, uint256 amount) external {
        require(amount > 0, "Multisend: No value");
        require(users.length > 0, "Multisend: No users");

        uint256 totalValue = amount;
        uint256 restAmount = totalValue;
        uint256 len = users.length;
        for(uint256 i = 0; i < len; ++i) {
            uint256 amountToUser;
            if (i < len - 1) {
                amountToUser = totalValue / len;
                restAmount -= amountToUser;
            } else {
                amountToUser = restAmount;
            }

            IERC20(token).transferFrom(msg.sender, users[i], amountToUser);
        }
    }
}