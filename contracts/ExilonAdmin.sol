// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

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

    function excludeFromFeesDistributionArray(address[] calldata users) external onlyAdmin {
        address _exilonToken = exilonToken;
        for (uint256 i = 0; i < users.length; ++i) {
            IExilon(_exilonToken).excludeFromFeesDistribution(users[i]);
        }
    }

    function includeToFeesDistribution(address user) external onlyAdmin {
        IExilon(exilonToken).includeToFeesDistribution(user);
    }

    function includeToFeesDistributionArray(address[] calldata users) external onlyAdmin {
        address _exilonToken = exilonToken;
        for (uint256 i = 0; i < users.length; ++i) {
            IExilon(_exilonToken).includeToFeesDistribution(users[i]);
        }
    }

    function excludeFromPayingFees(address user) external onlyAdmin {
        IExilon(exilonToken).excludeFromPayingFees(user);
    }

    function excludeFromPayingFeesArray(address[] calldata users) external onlyAdmin {
        address _exilonToken = exilonToken;
        for (uint256 i = 0; i < users.length; ++i) {
            IExilon(_exilonToken).excludeFromPayingFees(users[i]);
        }
    }

    function includeToPayingFees(address user) external onlyAdmin {
        IExilon(exilonToken).includeToPayingFees(user);
    }

    function includeToPayingFeesArray(address[] calldata users) external onlyAdmin {
        address _exilonToken = exilonToken;
        for (uint256 i = 0; i < users.length; ++i) {
            IExilon(_exilonToken).includeToPayingFees(users[i]);
        }
    }

    function enableLowerCommissions(address user) external onlyAdmin {
        IExilon(exilonToken).enableLowerCommissions(user);
    }

    function enableLowerCommissionsArray(address[] calldata users) external onlyAdmin {
        address _exilonToken = exilonToken;
        for (uint256 i = 0; i < users.length; ++i) {
            IExilon(_exilonToken).enableLowerCommissions(users[i]);
        }
    }

    function disableLowerCommissions(address user) external onlyAdmin {
        IExilon(exilonToken).disableLowerCommissions(user);
    }

    function disableLowerCommissionsArray(address[] calldata users) external onlyAdmin {
        address _exilonToken = exilonToken;
        for (uint256 i = 0; i < users.length; ++i) {
            IExilon(_exilonToken).disableLowerCommissions(users[i]);
        }
    }

    function setWethLimitForLpFee(uint256 newValue) external onlyAdmin {
        IExilon(exilonToken).setWethLimitForLpFee(newValue);
    }

    function setDefaultLpMintAddress(address newValue) external onlyAdmin {
        IExilon(exilonToken).setDefaultLpMintAddress(newValue);
    }

    function setMarketingAddress(address newValue) external onlyAdmin {
        IExilon(exilonToken).setMarketingAddress(newValue);
    }
}
