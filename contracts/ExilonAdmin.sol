// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IExilon.sol";

contract ExilonAdmin is AccessControl {
    address public immutable exilonToken;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Exilon: Sender is not admin");
        _;
    }

    constructor(address _exilonToken) {
        exilonToken = _exilonToken;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function addLiquidity() external payable onlyAdmin {
        IExilon(exilonToken).addLiquidity{value: msg.value}();
    }

    function forceLpFeesDistribute() external onlyAdmin {
        IExilon(exilonToken).forceLpFeesDistribute();
    }

    function excludeFromFeesDistribution(address user) external onlyAdmin {
        IExilon(exilonToken).excludeFromFeesDistribution(user);
    }

    function includeToFeesDistribution(address user) external onlyAdmin {
        IExilon(exilonToken).includeToFeesDistribution(user);
    }

    function excludeFromPayingFees(address user) external onlyAdmin {
        IExilon(exilonToken).excludeFromPayingFees(user);
    }

    function includeToPayingFees(address user) external onlyAdmin {
        IExilon(exilonToken).includeToPayingFees(user);
    }

    function setWethLimitForLpFee(uint256 newValue) external onlyAdmin {
        IExilon(exilonToken).setWethLimitForLpFee(newValue);
    }

    function setDefaultLpMintAddress(address newValue) external onlyAdmin {
        IExilon(exilonToken).setDefaultLpMintAddress(newValue);
    }

    function setFeeAmountInUsd(uint256 newValue) external onlyAdmin {
        IExilon(exilonToken).setFeeAmountInUsd(newValue);
    }

    function setMarketingAddress(address newValue) external onlyAdmin {
        IExilon(exilonToken).setMarketingAddress(newValue);
    }
}
