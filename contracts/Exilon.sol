// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./pancake-swap/interfaces/IPancakeRouter02.sol";
import "./pancake-swap/interfaces/IPancakeFactory.sol";
import "./pancake-swap/interfaces/IPancakePair.sol";
import "./pancake-swap/interfaces/IWETH.sol";

// Maded by TepNik
// https://www.linkedin.com/in/nikita-tepelin/
contract Exilon is IERC20, IERC20Metadata, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    /* STATE VARIABLES */

    // public data

    IPancakeRouter02 public immutable dexRouter;
    address public immutable dexPair;

    // private data

    uint8 private constant _DECIMALS = 8;

    string private constant _NAME = "Exilon";
    string private constant _SYMBOL = "XLN";

    mapping(address => mapping(address => uint256)) private _allowances;

    // "internal" balances for not fixed addresses
    mapping(address => uint256) private _notFixedBalances;
    // "external" balances for fixed addresses
    mapping(address => uint256) private _fixedBalances;

    //solhint-disable-next-line var-name-mixedcase
    uint256 private immutable _TOTAL_EXTERNAL_SUPPLY;
    uint256 private _notFixedExternalTotalSupply;

    uint256 private _notFixedInternalTotalSupply;

    // 0 - not added; 1 - added
    uint256 private _isLpAdded;
    address private _weth;

    // addresses that exluded from distribution of fees from transfers (have fixed balances)
    EnumerableSet.AddressSet private _excludedFromDistribution;

    /* MODIFIERS */

    modifier onlyWhenLiquidityAdded() {
        require(_isLpAdded == 1, "Exilon: Liquidity not added");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Exilon: Sender is not admin");
        _;
    }

    /* EVENTS */

    /* FUNCTIONS */

    // solhint-disable-next-line func-visibility
    constructor(IPancakeRouter02 _dexRouter, address[] memory toDistribute) {
        IPancakeFactory dexFactory = IPancakeFactory(_dexRouter.factory());
        address weth = _dexRouter.WETH();
        _weth = weth;
        address _dexPair = dexFactory.createPair(address(this), weth);
        dexPair = _dexPair;

        dexRouter = _dexRouter;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // add LP pair and burn address to excludedFromDistribution
        _excludedFromDistribution.add(_dexPair);
        _excludedFromDistribution.add(address(0xdead));

        uint256 totalAmount = 2500 * 10**9 * 10**_DECIMALS;
        _TOTAL_EXTERNAL_SUPPLY = totalAmount;
        // 80% to liquidity and 20% to private sale and team
        uint256 amountToLiquidity = (totalAmount * 8) / 10;

        // _fixedBalances[address(this)] only used for adding liquidity
        _excludedFromDistribution.add(address(this));
        _fixedBalances[address(this)] = amountToLiquidity;
        // add changes to transfer amountToLiquidity amount from NotFixed to Fixed account
        // because LP pair is exluded from distribution
        uint256 notFixedExternalTotalSupply = totalAmount;
        uint256 notFixedInternalTotalSupply = (type(uint256).max -
            (type(uint256).max % totalAmount)) / totalAmount;

        uint256 notFixedAmount = (amountToLiquidity * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        notFixedExternalTotalSupply -= amountToLiquidity;
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply -= notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        // notFixedInternalTotalSupply amount will be distributed between toDistribute addresses
        // it is addresses for team and private sale
        require(toDistribute.length > 0, "Exilon: Length error");
        uint256 restAmount = notFixedInternalTotalSupply;
        for (uint256 i = 0; i < toDistribute.length; ++i) {
            uint256 amountToDistribute;
            if (i < toDistribute.length - 1) {
                amountToDistribute = notFixedInternalTotalSupply / toDistribute.length;
                restAmount -= amountToDistribute;
            } else {
                amountToDistribute = restAmount;
            }

            _notFixedBalances[toDistribute[i]] = amountToDistribute;

            uint256 fixedAmountDistributed = (amountToDistribute * notFixedExternalTotalSupply) /
                notFixedInternalTotalSupply;
            emit Transfer(address(0), toDistribute[i], fixedAmountDistributed);
        }
        emit Transfer(address(0), address(this), amountToLiquidity);
    }

    /* receive() external payable {
    } */

    /* EXTERNAL FUNCTIONS */

    // this function will be used
    function addLiquidity() external payable onlyAdmin {
        require(_isLpAdded == 0, "Exilon: Only once");
        _isLpAdded = 1;

        uint256 amountToLiquidity = _fixedBalances[address(this)];
        delete _fixedBalances[address(this)];
        _excludedFromDistribution.remove(address(this));

        address _dexPair = dexPair;
        _fixedBalances[_dexPair] = amountToLiquidity;

        address weth = _weth;
        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).transfer(_dexPair, msg.value);

        IPancakePair(_dexPair).mint(_msgSender());

        emit Transfer(address(this), _dexPair, amountToLiquidity);
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount)
        external
        virtual
        override
        onlyWhenLiquidityAdded
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual override onlyWhenLiquidityAdded returns (bool) {
        uint256 currentAllowance = _allowances[sender][_msgSender()];
        require(currentAllowance >= amount, "Exilon: Amount exceeds allowance");
        unchecked {
            _approve(sender, _msgSender(), currentAllowance - amount);
        }

        _transfer(sender, recipient, amount);

        return true;
    }

    function excludeFromFeesDistribution(address user) external onlyWhenLiquidityAdded onlyAdmin {
        require(_excludedFromDistribution.add(user) == true, "Exilon: Already excluded");

        uint256 notFixedUserBalance = _notFixedBalances[user];
        if (notFixedUserBalance > 0) {
            uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
            uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

            uint256 fixedUserBalance = (notFixedExternalTotalSupply * notFixedUserBalance) /
                notFixedInternalTotalSupply;

            _fixedBalances[user] = fixedUserBalance;
            delete _notFixedBalances[user];

            notFixedExternalTotalSupply -= fixedUserBalance;
            _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

            notFixedInternalTotalSupply -= notFixedUserBalance;
            _notFixedInternalTotalSupply = notFixedInternalTotalSupply;
        }
    }

    function includeToFeesDistribution(address user) external onlyWhenLiquidityAdded onlyAdmin {
        require(user != address(0xdead) && user != dexPair, "Exilon: Wrong address");
        require(_excludedFromDistribution.remove(user) == true, "Exilon: Already included");

        uint256 fixedUserBalance = _fixedBalances[user];
        if (fixedUserBalance > 0) {
            uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
            uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

            uint256 notFixedUserBalance = (fixedUserBalance * notFixedInternalTotalSupply) /
                notFixedExternalTotalSupply;

            _notFixedBalances[user] = notFixedUserBalance;
            delete _fixedBalances[user];

            notFixedExternalTotalSupply += fixedUserBalance;
            _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

            notFixedInternalTotalSupply += notFixedUserBalance;
            _notFixedInternalTotalSupply = notFixedInternalTotalSupply;
        }
    }

    function name() external view virtual override returns (string memory) {
        return _NAME;
    }

    function symbol() external view virtual override returns (string memory) {
        return _SYMBOL;
    }

    function decimals() external view virtual override returns (uint8) {
        return _DECIMALS;
    }

    function totalSupply() external view virtual override returns (uint256) {
        return _TOTAL_EXTERNAL_SUPPLY;
    }

    function balanceOf(address account) external view virtual override returns (uint256) {
        if (_excludedFromDistribution.contains(account) == true) {
            return _fixedBalances[account];
        } else {
            return
                (_notFixedBalances[account] * _notFixedExternalTotalSupply) /
                _notFixedInternalTotalSupply;
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

    function excludedFromDistributionLen() external view returns (uint256) {
        return _excludedFromDistribution.length();
    }

    function getExcludedFromDistributionAt(uint256 index) external view returns (address) {
        return _excludedFromDistribution.at(index);
    }

    function isExcludedFromDistribution(address user) external view returns (bool) {
        return _excludedFromDistribution.contains(user);
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
            require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
            unchecked {
                _fixedBalances[from] = (fixedBalanceFrom - amount);
            }

            _fixedBalances[to] += amount;
        } else if (isFromFixed == true && isToFixed == false) {
            uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
            uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

            uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
                notFixedExternalTotalSupply;

            _notFixedBalances[to] += notFixedAmount;
            uint256 fixedBalanceFrom = _fixedBalances[from];
            require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
            unchecked {
                _fixedBalances[from] = (fixedBalanceFrom - amount);
            }

            notFixedExternalTotalSupply += amount;
            _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

            notFixedInternalTotalSupply += notFixedAmount;
            _notFixedInternalTotalSupply = notFixedInternalTotalSupply;
        } else if (isFromFixed == false && isToFixed == true) {
            uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
            uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

            uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
                notFixedExternalTotalSupply;

            uint256 notFixedBalanceFrom = _notFixedBalances[from];
            require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
            unchecked {
                _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);
            }
            _fixedBalances[to] += amount;

            notFixedExternalTotalSupply -= amount;
            _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

            notFixedInternalTotalSupply -= notFixedAmount;
            _notFixedInternalTotalSupply = notFixedInternalTotalSupply;
        } else if (isFromFixed == false && isToFixed == false) {
            uint256 notFixedAmount = (amount * _notFixedInternalTotalSupply) /
                _notFixedExternalTotalSupply;

            uint256 notFixedBalanceFrom = _notFixedBalances[from];
            require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
            unchecked {
                _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);
            }
            _notFixedBalances[to] += notFixedAmount;
        }
    }
}
