// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./pancake-swap/interfaces/IPancakeRouter02.sol";
import "./pancake-swap/interfaces/IPancakeFactory.sol";

// TODO: Permit function

// Maded by TepNik
contract Exilon is IERC20, IERC20Metadata, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    /* STATE VARIABLES */

    // public data

    IPancakeRouter02 public immutable dexRouter;
    address public immutable dexPair;

    // private data

    uint8 private _decimals = 18;

    string private _name = "Exilon";
    string private _symbol = "XLN";

    mapping(address => mapping(address => uint256)) private _allowances;

    // "internal" balances for not fixed addresses
    mapping(address => uint256) private _notFixedBalances;
    // "external" balances for fixed addresses
    mapping(address => uint256) private _fixedBalances;

    uint256 private _totalExternalSupply = 2500 * 10**9 * 10**_decimals;
    uint256 private _notFixedTotalExternalSupply = _totalExternalSupply;

    uint256 private _notFixedBalancesInternalTotalSupply = (type(uint256).max - (type(uint256).max % _totalExternalSupply));

    // 0 - not added; 1 - added
    uint256 private _isLpAdded;

    // addresses that exluded from distribution of fees from transfers (have fixed balances)
    EnumerableSet.AddressSet private _excludedFromDistribution;

    /* MODIFIERS */

    modifier onlyWhenLiquidityAdded {
        require(_isLpAdded == 1, "Exilon: Liquidity not added");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Exilon: Sender is not admin");
        _;
    }

    /* EVENTS */

    /* FUNCTIONS */

    // solhint-disable-next-line func-visibility
    constructor(IPancakeRouter02 _dexRouter, address[] memory toDistribute) {
        IPancakeFactory dexFactory = IPancakeFactory(_dexRouter.factory());
        address weth = _dexRouter.WETH();
        address _dexPair = dexFactory.createPair(address(this), weth);
        dexPair = _dexPair;

        dexRouter = _dexRouter;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // add LP pair and burn address to excludedFromDistribution
        _excludedFromDistribution.add(_dexPair);
        _excludedFromDistribution.add(address(0xdead));

        uint256 totalAmount = _totalExternalSupply;
        // 80% to liquidity
        uint256 amountToLiquidity = totalAmount * 8 / 10;
        // 20% to private sale and team
        uint256 amountToDistribute = totalAmount - amountToLiquidity;

        // TODO: add changing of _notFixedBalances and _fixedBalances

        emit Transfer(address(0), _dexPair, amountToLiquidity);
        // TODO: add events of transfer to toDistribute
    }

    /* receive() external payable {
    } */

    /* EXTERNAL FUNCTIONS */

    function addLiquidity() external payable onlyAdmin {
        revert("Exilon: Not implemented");
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external onlyWhenLiquidityAdded virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external onlyWhenLiquidityAdded virtual override returns (bool) {
        uint256 currentAllowance = _allowances[sender][_msgSender()];
        require(currentAllowance >= amount, "Exilon: Amount exceeds allowance");
        unchecked {
            _approve(sender, _msgSender(), currentAllowance - amount);
        }

        _transfer(sender, recipient, amount);

        return true;
    }

    function exludeFromFeesDistribution(address user) external onlyAdmin {
        require(_excludedFromDistribution.add(user) == true, "Exilon: Already exluded");

        uint256 notFixedUserBalance = _notFixedBalances[user];
        if (notFixedUserBalance > 0) {
            uint256 notFixedTotalExternalSupply = _notFixedTotalExternalSupply;
            uint256 notFixedBalancesInternalTotalSupply = _notFixedBalancesInternalTotalSupply;

            uint256 fixedUserBalance = notFixedTotalExternalSupply * notFixedUserBalance / notFixedBalancesInternalTotalSupply;

            _fixedBalances[user] = fixedUserBalance;
            delete _notFixedBalances[user];

            notFixedTotalExternalSupply -= fixedUserBalance;
            _notFixedTotalExternalSupply = notFixedTotalExternalSupply;

            notFixedBalancesInternalTotalSupply -= notFixedUserBalance;
            _notFixedBalancesInternalTotalSupply = notFixedBalancesInternalTotalSupply;
        }
    }

    function includeToFeesDistributon(address user) external onlyAdmin {
        require(user != address(0xdead) && user != dexPair, "Exilon: Wrong address");
        require(_excludedFromDistribution.remove(user) == true, "Exilon: Already included");

        uint256 fixedUserBalance = _fixedBalances[user];
        if (fixedUserBalance > 0) {
            uint256 notFixedTotalExternalSupply = _notFixedTotalExternalSupply;
            uint256 notFixedBalancesInternalTotalSupply = _notFixedBalancesInternalTotalSupply;

            uint256 notFixedUserBalance = (notFixedTotalExternalSupply + fixedUserBalance) * notFixedBalancesInternalTotalSupply / notFixedTotalExternalSupply;

            _notFixedBalances[user] = notFixedUserBalance;
            delete _fixedBalances[user];

            notFixedTotalExternalSupply += fixedUserBalance;
            _notFixedTotalExternalSupply = notFixedTotalExternalSupply;

            notFixedBalancesInternalTotalSupply += notFixedUserBalance;
            _notFixedBalancesInternalTotalSupply = notFixedBalancesInternalTotalSupply;
        }
    }

    function name() external view virtual override returns (string memory) {
        return _name;
    }

    function symbol() external view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() external view virtual override returns (uint8) {
        return _decimals;
    }

    function totalSupply() external view virtual override returns (uint256) {
        return _totalExternalSupply;
    }

    function balanceOf(address account) external view virtual override returns (uint256) {
        if (_excludedFromDistribution.contains(account) == true) {
            return _fixedBalances[account];
        } else {
            return _notFixedBalances[account] * _notFixedTotalExternalSupply / _notFixedBalancesInternalTotalSupply;
        }
    }

    function allowance(address owner, address spender)
        external
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    function excludedFromDistributionLen() external view returns(uint256) {
        return _excludedFromDistribution.length();
    }

    function getExcludedFromDistributionAt(uint256 index) external view returns(address) {
        return _excludedFromDistribution.at(index);
    }

    /* PUBLIC FUNCTIONS */

    /* INTERNAL FUNCTIONS */

    /* PRIVATE FUNCTIONS */

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(owner != address(0), "Exilon: From zero address");
        require(spender != address(0), "Exilon: To zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        bool isFromFixed = _excludedFromDistribution.contains(from);
        bool isToFixed = _excludedFromDistribution.contains(to);
        if (isFromFixed == true && isToFixed == true) {
            uint256 fixedBalanceFrom = _fixedBalances[from];
            require(fixedBalanceFrom >= amount, "Exilon: Transfer amount exceeds balance");
            unchecked {
                _fixedBalances[from] = (fixedBalanceFrom - amount);
            }

            _fixedBalances[to] += amount;
        } else if (isFromFixed == true && isToFixed == false) {
            uint256 notFixedTotalExternalSupply = _notFixedTotalExternalSupply;
            uint256 notFixedBalancesInternalTotalSupply = _notFixedBalancesInternalTotalSupply;

            uint256 notFixedAmount = (notFixedTotalExternalSupply + amount) * notFixedBalancesInternalTotalSupply / notFixedTotalExternalSupply;

            _notFixedBalances[to] += notFixedAmount;
            uint256 fixedBalanceFrom = _fixedBalances[from];
            require(fixedBalanceFrom >= amount, "Exilon: Transfer amount exceeds balance");
            unchecked {
                _fixedBalances[from] = (fixedBalanceFrom - amount);
            }

            notFixedTotalExternalSupply += amount;
            _notFixedTotalExternalSupply = notFixedTotalExternalSupply;

            notFixedBalancesInternalTotalSupply += notFixedAmount;
            _notFixedBalancesInternalTotalSupply = notFixedBalancesInternalTotalSupply;
        } else if (isFromFixed == false && isToFixed == true) {
            uint256 notFixedTotalExternalSupply = _notFixedTotalExternalSupply;
            uint256 notFixedBalancesInternalTotalSupply = _notFixedBalancesInternalTotalSupply;

            uint256 notFixedAmount = amount * notFixedBalancesInternalTotalSupply / notFixedTotalExternalSupply;

            uint256 notFixedBalanceFrom = _notFixedBalances[from];
            require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Transfer amount exceeds balance");
            unchecked {
                _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);
            }
            _fixedBalances[to] += amount;

            notFixedTotalExternalSupply -= amount;
            _notFixedTotalExternalSupply = notFixedTotalExternalSupply;

            notFixedBalancesInternalTotalSupply -= notFixedAmount;
            _notFixedBalancesInternalTotalSupply = notFixedBalancesInternalTotalSupply;
        } else if (isFromFixed == false && isToFixed == false) {
            uint256 notFixedAmount = amount * _notFixedBalancesInternalTotalSupply / _notFixedTotalExternalSupply;

            uint256 notFixedBalanceFrom = _notFixedBalances[from];
            require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Transfer amount exceeds balance");
            unchecked {
                _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);
            }
            _notFixedBalances[to] += notFixedAmount;
        }
    }
}
