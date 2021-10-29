// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExilon {
    function addLiquidity() external payable;

    function forceLpFeesDistribute() external;

    function excludeFromFeesDistribution(address user) external;

    function includeToFeesDistribution(address user) external;

    function excludeFromPayingFees(address user) external;

    function includeToPayingFees(address user) external;

    function setWethLimitForLpFee(uint256 newValue) external;

    function setDefaultLpMintAddress(address newValue) external;

    function setMarketingAddress(address newValue) external;
}
