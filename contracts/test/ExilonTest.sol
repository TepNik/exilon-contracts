// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Exilon.sol";

contract ExilonTest is Exilon {
    constructor(
        IPancakeRouter02 _dexRouter,
        address _usdAddress,
        address[] memory toDistribute,
        address _defaultLpMintAddress,
        address _marketingAddress
    ) Exilon(_dexRouter, _usdAddress, toDistribute, _defaultLpMintAddress, _marketingAddress) {}

    function setWethLimitForLpFeeTest(uint256 value) external onlyAdmin {
        wethLimitForLpFee = value;
    }
}
