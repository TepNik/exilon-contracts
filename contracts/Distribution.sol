// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Distribution is AccessControl, ReentrancyGuard {
    address public token;
    address public tokenLp;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Exilon: Sender is not admin");
        _;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setTokenInfo(address _token, address _tokenLp) external onlyAdmin {
        require(token == address(0) && tokenLp == address(0), "Distribution: Only once");
        require(_token != address(0) && _tokenLp != address(0), "Distribution: Input");

        token = _token;
        tokenLp = _tokenLp;
    }

    function withdrawToken(address[] memory users, uint256[] memory amounts)
        external
        onlyAdmin
        nonReentrant
    {
        IERC20 _token = IERC20(token);
        require(address(_token) != address(0), "Distribution: init");

        uint256 len = users.length;
        require(len == amounts.length, "Distribution: input");
        for (uint256 i = 0; i < len; ++i) {
            require(_token.transfer(users[i], amounts[i]), "Distribution: Transfer");
        }
    }

    function withdrawTokenLp(address user, uint256 amount) external onlyAdmin nonReentrant {
        IERC20 _token = IERC20(tokenLp);
        require(address(_token) != address(0), "Distribution: init");
        if (amount == 0) {
            amount = _token.balanceOf(address(this));
        }

        require(_token.transfer(user, amount), "Distribution: Transfer");
    }
}
