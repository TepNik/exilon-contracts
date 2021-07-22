// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./pancake-swap/libraries/PancakeLibrary.sol";

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

    uint256 public feeAmountInTokens;

    // private data

    uint8 private constant _DECIMALS = 8;

    string private constant _NAME = "Exilon";
    string private constant _SYMBOL = "XLNT";

    mapping(address => mapping(address => uint256)) private _allowances;

    // "internal" balances for not fixed addresses
    mapping(address => uint256) private _notFixedBalances;
    // "external" balances for fixed addresses
    mapping(address => uint256) private _fixedBalances;

    //solhint-disable-next-line var-name-mixedcase
    uint256 private immutable _TOTAL_EXTERNAL_SUPPLY;

    // axioms between _notFixedExternalTotalSupply and _notFixedInternalTotalSupply:
    // 1) _notFixedInternalTotalSupply % (_notFixedExternalTotalSupply ^ 2) == 0
    // 2) _notFixedInternalTotalSupply * _notFixedExternalTotalSupply <= type(uint256).max
    uint256 private _notFixedExternalTotalSupply;
    uint256 private _notFixedInternalTotalSupply;

    // 0 - not added; 1 - added
    uint256 private _isLpAdded;
    address private _weth;

    uint256 private _startBlock;

    // addresses that exluded from distribution of fees from transfers (have fixed balances)
    EnumerableSet.AddressSet private _excludedFromDistribution;
    EnumerableSet.AddressSet private _excludedFromPayingFees;
    EnumerableSet.AddressSet private _noRestrictionsOnSell;

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

        // div by totalAmount is needed because
        // notFixedExternalTotalSupply * notFixedInternalTotalSupply
        // must fit into uint256
        uint256 notFixedInternalTotalSupply = type(uint256).max / totalAmount;
        // make (internal % external ^ 2) == 0
        //notFixedInternalTotalSupply -= (notFixedInternalTotalSupply % totalAmount);

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
        _startBlock = block.number;

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

    function excludeFromPayingFees(address user) external onlyAdmin {
        require(user != address(0xdead) && user != dexPair, "Exilon: Wrong address");
        require(_excludedFromPayingFees.add(user) == true, "Exilon: Already excluded");
    }

    function includeToPayingFees(address user) external onlyAdmin {
        require(user != address(0xdead) && user != dexPair, "Exilon: Wrong address");
        require(_excludedFromPayingFees.remove(user) == true, "Exilon: Already included");
    }

    function removeRestrictionsOnSell(address user) external onlyAdmin {
        require(user != address(0xdead) && user != dexPair, "Exilon: Wrong address");
        require(_noRestrictionsOnSell.add(user) == true, "Exilon: Already removed");
    }

    function imposeRestrictionsOnSell(address user) external onlyAdmin {
        require(user != address(0xdead) && user != dexPair, "Exilon: Wrong address");
        require(_noRestrictionsOnSell.remove(user) == true, "Exilon: Already imposed");
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

    function excludedFromPayingFeesLen() external view returns (uint256) {
        return _excludedFromPayingFees.length();
    }

    function getExcludedFromPayingFeesAt(uint256 index) external view returns (address) {
        return _excludedFromPayingFees.at(index);
    }

    function isExcludedFromPayingFees(address user) external view returns (bool) {
        return _excludedFromPayingFees.contains(user);
    }

    function noRestrictionsOnSellLen() external view returns (uint256) {
        return _noRestrictionsOnSell.length();
    }

    function getNoRestrictionsOnSellAt(uint256 index) external view returns (address) {
        return _noRestrictionsOnSell.at(index);
    }

    function isNoRestrictionsOnSell(address user) external view returns (bool) {
        return _noRestrictionsOnSell.contains(user);
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

        uint256[3] memory fees;
        bool needToCheckFromBalance;
        {
            address _dexPair = dexPair;
            address weth = _weth;

            _checkBuyRestrictionsOnStart(to, _dexPair, weth);
            (fees, needToCheckFromBalance) = _getFeePercentages(from, to, _dexPair);
        }

        if (isFromFixed == true && isToFixed == true) {
            _transferBetweenFixed(from, to, amount, fees, needToCheckFromBalance);
        } else if (isFromFixed == true && isToFixed == false) {
            _transferFromFixedToNotFixed(from, to, amount, fees, needToCheckFromBalance);
        } else if (isFromFixed == false && isToFixed == true) {
            _trasnferFromNotFixedToFixed(from, to, amount, fees, needToCheckFromBalance);
        } else if (isFromFixed == false && isToFixed == false) {
            _transferBetweenNotFixed(from, to, amount, fees, needToCheckFromBalance);
        }
    }

    function _transferBetweenFixed(
        address from,
        address to,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance
    ) private {
        uint256 fixedBalanceFrom = _fixedBalances[from];
        require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
        unchecked {
            _fixedBalances[from] = (fixedBalanceFrom - amount);
        }

        fees = _getFeeAmounts(fees, amount, fixedBalanceFrom, needToCheckFromBalance);

        if (fees[0] > 0) {
            // Fee to lp pair
            uint256 _feeAmountInTokens = feeAmountInTokens;
            _feeAmountInTokens += fees[0];

            _checkFee(_feeAmountInTokens);
        }
        if (fees[1] > 0) {
            // Fee to burn
            _fixedBalances[address(0xdead)] += fees[1];
        }
        if (fees[2] > 0) {
            // Fee to distribute between users
            _notFixedExternalTotalSupply += fees[2];
        }

        uint256 transferAmount = amount - fees[0] - fees[1] - fees[2];
        _fixedBalances[to] += transferAmount;

        emit Transfer(from, to, transferAmount);
    }

    function _transferFromFixedToNotFixed(
        address from,
        address to,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance
    ) private {
        uint256 fixedBalanceFrom = _fixedBalances[from];
        require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
        unchecked {
            _fixedBalances[from] = (fixedBalanceFrom - amount);
        }

        fees = _getFeeAmounts(fees, amount, fixedBalanceFrom, needToCheckFromBalance);
        if (fees[0] > 0) {
            // Fee to lp pair
            uint256 _feeAmountInTokens = feeAmountInTokens;
            _feeAmountInTokens += fees[0];

            _checkFee(_feeAmountInTokens);
        }
        if (fees[1] > 0) {
            // Fee to burn
            _fixedBalances[address(0xdead)] += fees[1];
        }

        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 transferAmount = amount - fees[0] - fees[1] - fees[2];
        uint256 notFixedAmount = (transferAmount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;
        _notFixedBalances[to] += notFixedAmount;

        notFixedExternalTotalSupply += transferAmount + fees[2];
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply += notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(from, to, transferAmount);
    }

    function _trasnferFromNotFixedToFixed(
        address from,
        address to,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance
    ) private {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        uint256 notFixedBalanceFrom = _notFixedBalances[from];
        require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
        unchecked {
            _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);
        }

        fees = _getFeeAmounts(
            fees,
            amount,
            (notFixedBalanceFrom * notFixedExternalTotalSupply) / notFixedInternalTotalSupply,
            needToCheckFromBalance
        );
        if (fees[0] > 0) {
            // Fee to lp pair
            uint256 _feeAmountInTokens = feeAmountInTokens;
            _feeAmountInTokens += fees[0];

            _checkFee(_feeAmountInTokens);
        }
        if (fees[1] > 0) {
            // Fee to burn
            _fixedBalances[address(0xdead)] += fees[1];
        }

        uint256 transferAmount = amount - fees[0] - fees[1] - fees[2];
        _fixedBalances[to] += transferAmount;

        notFixedExternalTotalSupply -= amount;
        notFixedExternalTotalSupply += fees[2];
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply -= notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(from, to, transferAmount);
    }

    function _transferBetweenNotFixed(
        address from,
        address to,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance
    ) private {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        uint256 notFixedBalanceFrom = _notFixedBalances[from];
        require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
        unchecked {
            _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);
        }

        fees = _getFeeAmounts(fees, notFixedAmount, notFixedBalanceFrom, needToCheckFromBalance);
        uint256 fixedLpAmount = (fees[0] * notFixedExternalTotalSupply) /
            notFixedInternalTotalSupply;
        uint256 fixedBurnAmount = (fees[1] * notFixedExternalTotalSupply) /
            notFixedInternalTotalSupply;

        uint256 notFixedTransferAmount = notFixedAmount - fees[0] - fees[1] - fees[2];
        uint256 fixedTrasnferAmount = (notFixedTransferAmount * notFixedExternalTotalSupply) /
            notFixedInternalTotalSupply;
        _notFixedBalances[to] += notFixedTransferAmount;

        if (fixedLpAmount > 0) {
            // Fee to lp pair
            uint256 _feeAmountInTokens = feeAmountInTokens;
            _feeAmountInTokens += fixedLpAmount;
            _checkFee(_feeAmountInTokens);
        }
        if (fixedBurnAmount > 0) {
            // Fee to burn
            _fixedBalances[address(0xdead)] += fixedBurnAmount;
        }
        notFixedExternalTotalSupply -= fixedLpAmount + fixedBurnAmount;
        notFixedInternalTotalSupply -= fees[0] + fees[1] + fees[2];

        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(from, to, fixedTrasnferAmount);
    }

    function _checkFee(uint256 feeAmount) private {
        // TODO: implement logic
        feeAmountInTokens = feeAmount;
    }

    function _checkBuyRestrictionsOnStart(
        address to,
        address _dexPair,
        address weth
    ) private view {
        // only on buy tokens
        if (to == _dexPair) {
            return;
        }

        uint256 blocknumber = block.number - _startBlock;

        // [0; 60) - 0.1 BNB
        // [60; 120) - 0.2 BNB
        // [120; 180) - 0.3 BNB
        // [180; 240) - 0.4 BNB
        // [240; 300) - 0.5 BNB
        // [300; 360) - 0.6 BNB
        // [360; 420) - 0.7 BNB
        // [420; 480) - 0.8 BNB
        // [480; 540) - 0.9 BNB
        // [540; 600) - 1 BNB
        if (blocknumber < 600 && msg.sender != _dexPair) {
            // no flash loans and contracts on start
            // only users
            // solhint-disable-next-line avoid-tx-origin
            require(msg.sender == tx.origin, "Exilon: No contracts");
        }

        if (blocknumber < 60) {
            _checkBuyAmountCeil(_dexPair, 1 ether / 10, weth);
        } else if (blocknumber < 120) {
            _checkBuyAmountCeil(_dexPair, 2 ether / 10, weth);
        } else if (blocknumber < 180) {
            _checkBuyAmountCeil(_dexPair, 3 ether / 10, weth);
        } else if (blocknumber < 240) {
            _checkBuyAmountCeil(_dexPair, 4 ether / 10, weth);
        } else if (blocknumber < 300) {
            _checkBuyAmountCeil(_dexPair, 5 ether / 10, weth);
        } else if (blocknumber < 360) {
            _checkBuyAmountCeil(_dexPair, 6 ether / 10, weth);
        } else if (blocknumber < 420) {
            _checkBuyAmountCeil(_dexPair, 7 ether / 10, weth);
        } else if (blocknumber < 480) {
            _checkBuyAmountCeil(_dexPair, 8 ether / 10, weth);
        } else if (blocknumber < 540) {
            _checkBuyAmountCeil(_dexPair, 9 ether / 10, weth);
        } else if (blocknumber < 600) {
            _checkBuyAmountCeil(_dexPair, 1 ether, weth);
        }
    }

    function _checkBuyAmountCeil(
        address _dexPair,
        uint256 amount,
        address weth
    ) private view {
        address token = address(this);

        uint256 reserveWeth;
        (uint256 reserve0, uint256 reserve1, ) = IPancakePair(_dexPair).getReserves();
        (address token0, ) = PancakeLibrary.sortTokens(token, weth);
        if (token0 == token) {
            reserveWeth = reserve1;
        } else {
            reserveWeth = reserve0;
        }

        uint256 trueWethBalance = IERC20(weth).balanceOf(_dexPair);
        require(trueWethBalance - reserveWeth <= amount, "Exilon: To big buy amount");
    }

    function _getFeePercentages(
        address from,
        address to,
        address _dexPair
    ) private view returns (uint256[3] memory percentages, bool needToCheckFromBalance) {
        // percentages[0] - LP percentages
        // percentages[1] - burn percentages
        // percentages[2] - distribution percentages

        // if needToCheckFromBalance == true
        // then calculation of fee is carried over
        // because of the gas optimisation (checking of balances is further in code)

        if (to == _dexPair) {
            // if selling
            if (_excludedFromPayingFees.contains(from)) {
                return ([uint256(0), 0, 0], false);
            }
            if (_noRestrictionsOnSell.contains(from)) {
                return ([uint256(8), 1, 1], false);
            }

            // [0, 200) - 25%
            // [200, 350) - 24%
            // [350, 450) - 23%
            // [450, 550) - 22%
            // [550, 650) - 21%
            // [650, 750) - 20%
            // [750, 850) - 19%
            // [850, 950) - 18%
            // [950, 1050) - 17%
            // [1050, 1150) - 16%
            // [1150, 1250) - 15%
            // [1250, 1350) - 14%
            // [1350, 1450) - 13%
            // [1450, 1550) - 12%
            // [1550, 1650) - 11%
            // [1650, +inf) - 10% + checking of balance (if selling >=50% of balance)

            uint256 blocknumber = block.number - _startBlock;
            if (blocknumber < 1650) {
                if (blocknumber < 200) {
                    return ([uint256(23), 1, 1], false);
                } else if (blocknumber < 350) {
                    return ([uint256(22), 1, 1], false);
                } else {
                    return ([21 - ((blocknumber - 350) / 100), 1, 1], false);
                }
            } else {
                return ([uint256(0), 0, 0], true);
            }
        } else if (from == _dexPair) {
            // if buying
            if (_excludedFromPayingFees.contains(to)) {
                // if buying account is excluded from paying fees
                return ([uint256(0), 0, 0], false);
            }
        } else {
            // if transfer
            if (_excludedFromPayingFees.contains(from)) {
                return ([uint256(0), 0, 0], false);
            }
        }
        return ([uint256(8), 1, 1], false);
    }

    function _getFeeAmounts(
        uint256[3] memory percentages,
        uint256 amount,
        uint256 balance,
        bool needToCheckFromBalance
    ) private pure returns (uint256[3] memory amounts) {
        if (needToCheckFromBalance) {
            if (amount < balance / 2) {
                amounts[0] = (amount * 8) / 100;
                amounts[1] = amount / 100;
                amounts[2] = amounts[1];
            } else {
                amounts[0] = (amount * 13) / 100;
                amounts[1] = amount / 100;
                amounts[2] = amounts[1];
            }
        } else {
            amounts[0] = (amount * percentages[0]) / 100;
            amounts[1] = (amount * percentages[1]) / 100;
            amounts[2] = (amount * percentages[2]) / 100;
        }
    }
}
