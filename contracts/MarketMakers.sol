// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract MarketMakers is AccessControl {
    /* using EnumerableSet for EnumerableSet.AddressSet;

    struct Portfolio {
        uint256 tokenAmount;
        uint256 wethAmount;
        EnumerableSet.AddressSet traders;
    }

    address public immutable token;

    uint256 public percToTeam = 30;
    uint256 public percToMarketing = 30;
    uint256 public percToTrader = 10;

    address[] public teamAddresses;
    uint256[] public teamPercentages;

    uint256 private immutable ONE_TOKEN;

    uint256 private portoflioSize;
    mapping(uint256 => Portfolio) private portoflioInfo;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "MarketMakers: Sender is not admin");
        _;
    }

    constructor(address _token) {
        token = _token;
        ONE_TOKEN = IERC20Metadata(_token).decimals();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setPercentages(
        uint256 _percToTeam,
        uint256 _percToMarketing,
        uint256 _percToTrader
    ) external onlyAdmin {
        require(
            _percToTeam + _percToMarketing + _percToTrader <= 100,
            "MarketMakers: Wrong percentages"
        );

        percToTeam = _percToTeam;
        percToMarketing = _percToMarketing;
        percToTrader = _percToTrader;
    }

    function setTeamDistribution(address[] memory _teamAddresses, uint256[] memory _teamPercentages)
        external
        onlyAdmin
    {
        require(
            _teamAddresses.length > 0 && _teamAddresses.length == _teamPercentages.length,
            "MarketMakers: Wrong input"
        );

        teamAddresses = _teamAddresses;
        teamPercentages = _teamPercentages;

        uint256 totalPerc;
        for (uint256 i = 0; i < _teamPercentages.length; ++i) {
            totalPerc += _teamPercentages[i];
        }
        require(totalPerc == 100, "MarketMakers: Wrong percentages");
    }

    function addPortfolio(address[] calldata traders) external onlyAdmin {
        uint256 len = portoflioSize;
        for (uint256 i = 0; i < traders.length; ++i) {
            portoflioInfo[len].traders.add(traders[i]);
        }
    }

    function removeProtfolio(uint256 index) external onlyAdmin {
        uint256 len = portoflioSize;
        require(index < len, "MarketMakers: Wrong index");
        if (len > 1 && index < len - 1) {
            portoflioInfo[index] = portoflioInfo[len - 1];
        }
        delete portoflioInfo[len - 1];
    } */
}
