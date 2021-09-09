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

import "./WethReceiver.sol";

contract Exilon is IERC20, IERC20Metadata, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct PoolInfo {
        uint256 tokenReserves;
        uint256 wethReserves;
        uint256 wethBalance;
        address dexPairExilonWeth;
        address weth;
        address thisContract;
        bool exilonIsToken0;
    }

    /* STATE VARIABLES */

    // public data

    IPancakeRouter02 public immutable dexRouter;
    address public immutable dexPairExilonWeth;
    address public immutable dexPairUsdWeth;
    address public wethReceiver;

    address public defaultLpMintAddress;

    uint256 public feeAmountInTokens;
    uint256 public wethLimitForLpFee = 2 ether;

    // private data

    uint8 private constant _DECIMALS = 6;

    string private constant _NAME = "Exilon";
    string private constant _SYMBOL = "XLNT";

    mapping(address => mapping(address => uint256)) private _allowances;

    // "internal" balances for not fixed addresses
    mapping(address => uint256) private _notFixedBalances;
    // "external" balances for fixed addresses
    mapping(address => uint256) private _fixedBalances;

    //solhint-disable-next-line var-name-mixedcase
    uint256 private immutable _TOTAL_EXTERNAL_SUPPLY;

    // _notFixedInternalTotalSupply * _notFixedExternalTotalSupply <= type(uint256).max
    uint256 private _notFixedExternalTotalSupply;
    uint256 private _notFixedInternalTotalSupply;

    // 0 - not added; 1 - added
    uint256 private _isLpAdded;
    address private immutable _weth;

    uint256 private _startBlock;

    // addresses that exluded from distribution of fees from transfers (have fixed balances)
    EnumerableSet.AddressSet private _excludedFromDistribution;
    EnumerableSet.AddressSet private _excludedFromPayingFees;

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
    constructor(
        IPancakeRouter02 _dexRouter,
        address _dexPairUsdWeth,
        address[] memory toDistribute,
        address _defaultLpMintAddress
    ) {
        IPancakeFactory dexFactory = IPancakeFactory(_dexRouter.factory());
        address weth = _dexRouter.WETH();
        _weth = weth;
        address _dexPairExilonWeth = dexFactory.createPair(address(this), weth);
        dexPairExilonWeth = _dexPairExilonWeth;
        dexPairUsdWeth = _dexPairUsdWeth;

        dexRouter = _dexRouter;

        defaultLpMintAddress = _defaultLpMintAddress;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // add LP pair and burn address to excludedFromDistribution
        _excludedFromDistribution.add(_dexPairExilonWeth);
        _excludedFromDistribution.add(address(0xdead));

        uint256 totalAmount = 7 * 10**12 * 10**_DECIMALS;
        _TOTAL_EXTERNAL_SUPPLY = totalAmount;
        // 65% to liquidity
        uint256 amountToLiquidity = (totalAmount * 65) / 100;

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

        address _dexPairExilonWeth = dexPairExilonWeth;
        _fixedBalances[_dexPairExilonWeth] = amountToLiquidity;

        address weth = _weth;
        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).transfer(_dexPairExilonWeth, msg.value);

        IPancakePair(_dexPairExilonWeth).mint(defaultLpMintAddress);

        emit Transfer(address(this), _dexPairExilonWeth, amountToLiquidity);
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
        _approve(sender, _msgSender(), currentAllowance - amount);

        _transfer(sender, recipient, amount);

        return true;
    }

    function forceLpFeesDistribute() external onlyWhenLiquidityAdded onlyAdmin {
        PoolInfo memory poolInfo;
        poolInfo.dexPairExilonWeth = dexPairExilonWeth;
        poolInfo.weth = _weth;
        _distributeFeesToLpAndBurn(address(0), [uint256(0), 0], true, poolInfo);
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
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
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
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
        require(_excludedFromPayingFees.add(user) == true, "Exilon: Already excluded");
    }

    function includeToPayingFees(address user) external onlyAdmin {
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
        require(_excludedFromPayingFees.remove(user) == true, "Exilon: Already included");
    }

    function setWethLimitForLpFee(uint256 value) external onlyAdmin {
        wethLimitForLpFee = value;
    }

    function setDefaultLpMintAddress(address value) external onlyAdmin {
        defaultLpMintAddress = value;
    }

    function setWethReceiver(address value) external onlyAdmin {
        require(wethReceiver == address(0), "Exilon: Only once");
        wethReceiver = value;
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
        PoolInfo memory poolInfo;
        poolInfo.dexPairExilonWeth = dexPairExilonWeth;
        poolInfo.weth = _weth;
        {
            poolInfo = _checkBuyRestrictionsOnStart(from, poolInfo);
            (fees, needToCheckFromBalance) = _getFeePercentages(
                from,
                to,
                poolInfo.dexPairExilonWeth
            );
        }

        if (isFromFixed == true && isToFixed == true) {
            _transferFromFixedToFixed([from, to], amount, fees, needToCheckFromBalance, poolInfo);
        } else if (isFromFixed == true && isToFixed == false) {
            _transferFromFixedToNotFixed(
                [from, to],
                amount,
                fees,
                needToCheckFromBalance,
                poolInfo
            );
        } else if (isFromFixed == false && isToFixed == true) {
            _trasnferFromNotFixedToFixed(
                [from, to],
                amount,
                fees,
                needToCheckFromBalance,
                poolInfo
            );
        } else if (isFromFixed == false && isToFixed == false) {
            _transferFromNotFixedToNotFixed(
                [from, to],
                amount,
                fees,
                needToCheckFromBalance,
                poolInfo
            );
        }
    }

    function _transferFromFixedToFixed(
        address[2] memory fromAndTo,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance,
        PoolInfo memory poolInfo
    ) private {
        uint256 fixedBalanceFrom = _fixedBalances[fromAndTo[0]];
        require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
        unchecked {
            _fixedBalances[fromAndTo[0]] = (fixedBalanceFrom - amount);
        }

        fees = _getFeeAmounts(fees, amount, fixedBalanceFrom, needToCheckFromBalance);

        _distributeFeesToLpAndBurn(fromAndTo[0], [fees[0], fees[1]], false, poolInfo);
        if (fees[2] > 0) {
            // Fee to distribute between users
            _notFixedExternalTotalSupply += fees[2];
        }

        uint256 transferAmount = amount - fees[0] - fees[1] - fees[2];
        _fixedBalances[fromAndTo[1]] += transferAmount;

        emit Transfer(fromAndTo[0], fromAndTo[1], transferAmount);
    }

    function _transferFromFixedToNotFixed(
        address[2] memory fromAndTo,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance,
        PoolInfo memory poolInfo
    ) private {
        uint256 fixedBalanceFrom = _fixedBalances[fromAndTo[0]];
        require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
        _fixedBalances[fromAndTo[0]] = (fixedBalanceFrom - amount);

        fees = _getFeeAmounts(fees, amount, fixedBalanceFrom, needToCheckFromBalance);
        _distributeFeesToLpAndBurn(fromAndTo[0], [fees[0], fees[1]], false, poolInfo);

        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 transferAmount = amount - fees[0] - fees[1] - fees[2];
        uint256 notFixedAmount = (transferAmount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;
        _notFixedBalances[fromAndTo[1]] += notFixedAmount;

        notFixedExternalTotalSupply += transferAmount + fees[2];
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply += notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(fromAndTo[0], fromAndTo[1], transferAmount);
    }

    function _trasnferFromNotFixedToFixed(
        address[2] memory fromAndTo,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance,
        PoolInfo memory poolInfo
    ) private {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        uint256 notFixedBalanceFrom = _notFixedBalances[fromAndTo[0]];
        require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
        _notFixedBalances[fromAndTo[0]] = (notFixedBalanceFrom - notFixedAmount);

        fees = _getFeeAmounts(
            fees,
            amount,
            (notFixedBalanceFrom * notFixedExternalTotalSupply) / notFixedInternalTotalSupply,
            needToCheckFromBalance
        );
        _distributeFeesToLpAndBurn(fromAndTo[0], [fees[0], fees[1]], false, poolInfo);

        uint256 transferAmount = amount - fees[0] - fees[1] - fees[2];
        _fixedBalances[fromAndTo[1]] += transferAmount;

        notFixedExternalTotalSupply -= amount;
        notFixedExternalTotalSupply += fees[2];
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply -= notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(fromAndTo[0], fromAndTo[1], transferAmount);
    }

    function _transferFromNotFixedToNotFixed(
        address[2] memory fromAndTo,
        uint256 amount,
        uint256[3] memory fees,
        bool needToCheckFromBalance,
        PoolInfo memory poolInfo
    ) private {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        {
            uint256 notFixedBalanceFrom = _notFixedBalances[fromAndTo[0]];
            require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
            _notFixedBalances[fromAndTo[0]] = (notFixedBalanceFrom - notFixedAmount);

            fees = _getFeeAmounts(
                fees,
                notFixedAmount,
                notFixedBalanceFrom,
                needToCheckFromBalance
            );
        }

        uint256 fixedLpAmount = (fees[0] * notFixedExternalTotalSupply) /
            notFixedInternalTotalSupply;
        uint256 fixedBurnAmount = (fees[1] * notFixedExternalTotalSupply) /
            notFixedInternalTotalSupply;

        _distributeFeesToLpAndBurn(fromAndTo[0], [fixedLpAmount, fixedBurnAmount], false, poolInfo);

        uint256 fixedTrasnferAmount;
        {
            uint256 notFixedTransferAmount = notFixedAmount - fees[0] - fees[1] - fees[2];
            fixedTrasnferAmount =
                (notFixedTransferAmount * notFixedExternalTotalSupply) /
                notFixedInternalTotalSupply;
            _notFixedBalances[fromAndTo[1]] += notFixedTransferAmount;
        }

        notFixedExternalTotalSupply -= fixedLpAmount + fixedBurnAmount;
        notFixedInternalTotalSupply -= fees[0] + fees[1] + fees[2];

        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(fromAndTo[0], fromAndTo[1], fixedTrasnferAmount);
    }

    function _distributeFeesToLpAndBurn(
        address from,
        uint256[2] memory lpAndBurnAmounts,
        bool isForce,
        PoolInfo memory poolInfo
    ) private {
        if (lpAndBurnAmounts[1] > 0) {
            uint256 burnAddressBalance = _fixedBalances[address(0xdead)];
            uint256 maxBalanceInBurnAddress = (_TOTAL_EXTERNAL_SUPPLY * 6) / 10;
            if (burnAddressBalance < maxBalanceInBurnAddress) {
                uint256 burnAddressBalanceBefore = burnAddressBalance;
                burnAddressBalance += lpAndBurnAmounts[1];
                if (burnAddressBalance > maxBalanceInBurnAddress) {
                    lpAndBurnAmounts[0] += burnAddressBalance - maxBalanceInBurnAddress;
                    burnAddressBalance = maxBalanceInBurnAddress;
                }
                _fixedBalances[address(0xdead)] = burnAddressBalance;
                emit Transfer(from, address(0xdead), burnAddressBalance - burnAddressBalanceBefore);
            } else {
                lpAndBurnAmounts[0] += lpAndBurnAmounts[1];
            }
        }

        if (lpAndBurnAmounts[0] > 0 || isForce) {
            // Fee to lp pair
            uint256 _feeAmountInTokens = feeAmountInTokens;
            if (lpAndBurnAmounts[0] > 0) {
                emit Transfer(from, address(0), lpAndBurnAmounts[0]);
            }
            _feeAmountInTokens += lpAndBurnAmounts[0];

            if (_feeAmountInTokens == 0) {
                return;
            }

            if (from == poolInfo.dexPairExilonWeth) {
                // if removing lp or buy tokens then exit
                // because dex pair is locked
                if (lpAndBurnAmounts[0] > 0) {
                    feeAmountInTokens = _feeAmountInTokens;
                }
                return;
            }

            if (poolInfo.tokenReserves == 0) {
                poolInfo = _getDexPairInfo(poolInfo);
            }

            uint256 contractBalance = IERC20(poolInfo.weth).balanceOf(poolInfo.thisContract);
            uint256 wethFeesPrice = PancakeLibrary.getAmountOut(
                _feeAmountInTokens,
                poolInfo.tokenReserves,
                poolInfo.wethReserves
            );

            if (
                wethFeesPrice == 0 ||
                (isForce == false && wethFeesPrice + contractBalance < wethLimitForLpFee)
            ) {
                if (lpAndBurnAmounts[0] > 0) {
                    feeAmountInTokens = _feeAmountInTokens;
                }
                return;
            }

            uint256 wethAmountReturn;
            if (poolInfo.wethReserves < poolInfo.wethBalance) {
                // if in pool already weth of user
                // it can happen if user is adding lp
                wethAmountReturn = poolInfo.wethBalance - poolInfo.wethReserves;
                IPancakePair(poolInfo.dexPairExilonWeth).skim(poolInfo.thisContract);
            }

            uint256 amountOfWethToBuy = (wethFeesPrice + contractBalance) / 2;
            if (amountOfWethToBuy > contractBalance) {
                amountOfWethToBuy -= contractBalance;

                uint256 amountTokenToSell = PancakeLibrary.getAmountIn(
                    amountOfWethToBuy,
                    poolInfo.tokenReserves,
                    poolInfo.wethReserves
                );

                if (amountTokenToSell == 0) {
                    if (lpAndBurnAmounts[0] > 0) {
                        feeAmountInTokens = _feeAmountInTokens;
                    }
                    return;
                }

                _fixedBalances[poolInfo.dexPairExilonWeth] += amountTokenToSell;
                emit Transfer(address(0), poolInfo.dexPairExilonWeth, amountTokenToSell);
                {
                    uint256 amount0Out;
                    uint256 amount1Out;
                    if (poolInfo.exilonIsToken0) {
                        amount1Out = amountOfWethToBuy;
                    } else {
                        amount0Out = amountOfWethToBuy;
                    }
                    address _wethReceiver = wethReceiver;
                    IPancakePair(poolInfo.dexPairExilonWeth).swap(
                        amount0Out,
                        amount1Out,
                        _wethReceiver,
                        ""
                    );
                    WethReceiver(_wethReceiver).getWeth(poolInfo.weth, amountOfWethToBuy);
                }
                _feeAmountInTokens -= amountTokenToSell;
                contractBalance += amountOfWethToBuy;

                poolInfo.tokenReserves += amountTokenToSell;
                poolInfo.wethReserves -= amountOfWethToBuy;
            }

            uint256 amountOfTokens = PancakeLibrary.quote(
                contractBalance,
                poolInfo.wethReserves,
                poolInfo.tokenReserves
            );
            uint256 amountOfWeth = contractBalance;
            if (amountOfTokens > _feeAmountInTokens) {
                amountOfWeth = PancakeLibrary.quote(
                    _feeAmountInTokens,
                    poolInfo.tokenReserves,
                    poolInfo.wethReserves
                );
                amountOfTokens = _feeAmountInTokens;
            }

            _fixedBalances[poolInfo.dexPairExilonWeth] += amountOfTokens;
            feeAmountInTokens = _feeAmountInTokens - amountOfTokens;

            emit Transfer(address(0), poolInfo.dexPairExilonWeth, amountOfTokens);

            IERC20(poolInfo.weth).transfer(poolInfo.dexPairExilonWeth, amountOfWeth);
            IPancakePair(poolInfo.dexPairExilonWeth).mint(defaultLpMintAddress);

            if (wethAmountReturn > 0) {
                IERC20(poolInfo.weth).transfer(poolInfo.dexPairExilonWeth, wethAmountReturn);
            }
        }
    }

    function _checkBuyRestrictionsOnStart(address from, PoolInfo memory poolInfo)
        private
        view
        returns (PoolInfo memory)
    {
        // only on buy tokens
        if (from != poolInfo.dexPairExilonWeth) {
            return poolInfo;
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

        if (blocknumber < 600) {
            if (blocknumber < 60) {
                return _checkBuyAmountCeil(poolInfo, 1 ether / 10);
            } else if (blocknumber < 120) {
                return _checkBuyAmountCeil(poolInfo, 2 ether / 10);
            } else if (blocknumber < 180) {
                return _checkBuyAmountCeil(poolInfo, 3 ether / 10);
            } else if (blocknumber < 240) {
                return _checkBuyAmountCeil(poolInfo, 4 ether / 10);
            } else if (blocknumber < 300) {
                return _checkBuyAmountCeil(poolInfo, 5 ether / 10);
            } else if (blocknumber < 360) {
                return _checkBuyAmountCeil(poolInfo, 6 ether / 10);
            } else if (blocknumber < 420) {
                return _checkBuyAmountCeil(poolInfo, 7 ether / 10);
            } else if (blocknumber < 480) {
                return _checkBuyAmountCeil(poolInfo, 8 ether / 10);
            } else if (blocknumber < 540) {
                return _checkBuyAmountCeil(poolInfo, 9 ether / 10);
            } else if (blocknumber < 600) {
                return _checkBuyAmountCeil(poolInfo, 1 ether);
            }
        }

        return poolInfo;
    }

    function _checkBuyAmountCeil(PoolInfo memory poolInfo, uint256 amount)
        private
        view
        returns (PoolInfo memory)
    {
        poolInfo = _getDexPairInfo(poolInfo);

        if (poolInfo.wethBalance >= poolInfo.wethReserves) {
            // if not removing lp
            require(
                poolInfo.wethBalance - poolInfo.wethReserves <= amount,
                "Exilon: To big buy amount"
            );
        }

        return poolInfo;
    }

    function _getDexPairInfo(PoolInfo memory poolInfo) private view returns (PoolInfo memory) {
        poolInfo.thisContract = address(this);

        (uint256 reserve0, uint256 reserve1, ) = IPancakePair(poolInfo.dexPairExilonWeth)
            .getReserves();
        (address token0, ) = PancakeLibrary.sortTokens(poolInfo.thisContract, poolInfo.weth);
        if (token0 == poolInfo.thisContract) {
            poolInfo.tokenReserves = reserve0;
            poolInfo.wethReserves = reserve1;
            poolInfo.exilonIsToken0 = true;
        } else {
            poolInfo.wethReserves = reserve0;
            poolInfo.tokenReserves = reserve1;
            poolInfo.exilonIsToken0 = false;
        }
        poolInfo.wethBalance = IERC20(poolInfo.weth).balanceOf(poolInfo.dexPairExilonWeth);

        return poolInfo;
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
                    return ([uint256(23), 3, 1], false);
                } else if (blocknumber < 350) {
                    return ([uint256(22), 3, 1], false);
                } else {
                    return ([21 - ((blocknumber - 350) / 100), 3, 1], false);
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
        return ([uint256(8), 3, 1], false);
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
                amounts[1] = (amount * 3) / 100;
                amounts[2] = amount / 100;
            } else if (amount < (balance * 3) / 4) {
                amounts[0] = (amount * 13) / 100;
                amounts[1] = (amount * 3) / 100;
                amounts[2] = amount / 100;
            } else {
                amounts[0] = (amount * 18) / 100;
                amounts[1] = (amount * 3) / 100;
                amounts[2] = amount / 100;
            }
        } else {
            amounts[0] = (amount * percentages[0]) / 100;
            amounts[1] = (amount * percentages[1]) / 100;
            amounts[2] = (amount * percentages[2]) / 100;
        }
    }
}
