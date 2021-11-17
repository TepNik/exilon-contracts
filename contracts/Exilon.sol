// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./pancake-swap/libraries/PancakeLibrary.sol";

import "./pancake-swap/interfaces/IPancakeRouter02.sol";
import "./pancake-swap/interfaces/IPancakeFactory.sol";
import "./pancake-swap/interfaces/IPancakePair.sol";
import "./pancake-swap/interfaces/IWETH.sol";

import "./WethReceiver.sol";

import "./interfaces/IExilon.sol";

contract Exilon is IERC20, IERC20Metadata, AccessControl, IExilon {
    /* STATE VARIABLES */

    // public data

    IPancakeRouter02 public immutable dexRouter;
    address public immutable dexPairExilonWeth;
    address public immutable dexPairUsdWeth;
    address public immutable usdAddress;
    address public wethReceiver;

    address public defaultLpMintAddress;
    address public marketingAddress;

    uint256 public feeAmountInTokens;
    uint256 public wethLimitForLpFee = 1 ether;
    uint256 public immutable feeAmountInUsd;

    address public reserveFeeAddress;
    uint256 public reserveFee;

    // private data

    uint8 private constant _DECIMALS = 6;

    string private constant _NAME = "Exilon";
    string private constant _SYMBOL = "EXL";

    mapping(address => mapping(address => uint256)) private _allowances;

    // "internal" balances for not fixed addresses
    mapping(address => uint256) private _notFixedBalances;
    // "external" balances for fixed addresses
    mapping(address => uint256) private _fixedBalances;

    uint256 private constant _TOTAL_EXTERNAL_SUPPLY = 5 * 10**12 * 10**_DECIMALS;
    // div by _TOTAL_EXTERNAL_SUPPLY is needed because
    // notFixedExternalTotalSupply * notFixedInternalTotalSupply
    // must fit into uint256
    uint256 private constant _MAX_INTERNAL_SUPPLY = type(uint256).max / _TOTAL_EXTERNAL_SUPPLY;
    uint256 private constant _INITIAL_AMOUNT_TO_LIQUIDITY = (_TOTAL_EXTERNAL_SUPPLY * 40) / 100;

    // _notFixedInternalTotalSupply * _notFixedExternalTotalSupply <= type(uint256).max
    uint256 private _notFixedExternalTotalSupply;
    uint256 private _notFixedInternalTotalSupply;

    // 0 - not added; 1 - added
    uint256 private _isLpAdded;
    address private immutable _weth;

    uint256 private _startBlock;
    uint256 private _startTimestamp;

    // addresses that exluded from distribution of fees from transfers (have fixed balances)
    mapping(address => bool) public isExcludedFromDistribution;
    mapping(address => bool) public isExcludedFromPayingFees;
    mapping(address => bool) public isHavingLowerCommissions;

    /* MODIFIERS */

    modifier onlyWhenLiquidityAdded() {
        require(_isLpAdded == 1, "Exilon: Liquidity not added");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Exilon: Sender is not admin");
        _;
    }

    /* EVENTS */

    event ExcludedFromFeesDistribution(address indexed user);
    event IncludedToFeesDistribution(address indexed user);

    event ExcludedFromPayingFees(address indexed user);
    event IncludedToPayingFees(address indexed user);

    event EnabledLowerCommissions(address indexed user);
    event DisabledLowerCommissions(address indexed user);

    event ChangeWethLimitForLpFee(uint256 oldValue, uint256 newValue);
    event ChangeDefaultLpMintAddress(address indexed oldValue, address indexed newValue);
    event ChangeMarketingAddress(address oldValue, address newValue);

    event ForceLpFeesDistribution();

    event LiquidityAdded(uint256 amount);

    event TokenDistribution(uint256 amount);

    /* STRUCTS */

    struct FeesInfo {
        uint256 lpFee;
        uint256 distributeFee;
        uint256 burnFee;
        uint256 marketingFee;
        uint256 reserveFee;
    }

    struct PoolInfo {
        uint256 tokenReserves;
        uint256 wethReserves;
        uint256 wethBalance;
        address dexPair;
        address weth;
        bool isToken0;
    }

    /* FUNCTIONS */

    constructor(
        IPancakeRouter02 _dexRouter,
        address _usdAddress,
        address[] memory toDistribute,
        address _defaultLpMintAddress,
        address _marketingAddress
    ) {
        dexRouter = _dexRouter;
        IPancakeFactory dexFactory = IPancakeFactory(_dexRouter.factory());

        address weth = _dexRouter.WETH();
        _weth = weth;

        address _dexPairExilonWeth = dexFactory.createPair(address(this), weth);
        dexPairExilonWeth = _dexPairExilonWeth;

        {
            usdAddress = _usdAddress;
            feeAmountInUsd = 10**IERC20Metadata(_usdAddress).decimals();

            address _dexPairUsdWeth = dexFactory.getPair(weth, _usdAddress);
            require(_dexPairUsdWeth != address(0), "Exilon: Wrong usd token");
            dexPairUsdWeth = _dexPairUsdWeth;
        }

        defaultLpMintAddress = _defaultLpMintAddress;
        marketingAddress = _marketingAddress;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // add LP pair and burn address to excludedFromDistribution
        isExcludedFromDistribution[_dexPairExilonWeth] = true;
        isExcludedFromDistribution[address(0xdead)] = true;
        isExcludedFromDistribution[_marketingAddress] = true;

        // _fixedBalances[address(this)] only used for adding liquidity
        isExcludedFromDistribution[address(this)] = true;
        _fixedBalances[address(this)] = _INITIAL_AMOUNT_TO_LIQUIDITY;
        // add changes to transfer _INITIAL_AMOUNT_TO_LIQUIDITY amount from NotFixed to Fixed account
        // because LP pair is exluded from distribution
        uint256 notFixedExternalTotalSupply = _TOTAL_EXTERNAL_SUPPLY;

        uint256 notFixedInternalTotalSupply = _MAX_INTERNAL_SUPPLY;

        uint256 notFixedAmount = (_INITIAL_AMOUNT_TO_LIQUIDITY * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        notFixedExternalTotalSupply -= _INITIAL_AMOUNT_TO_LIQUIDITY;
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply -= notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        // notFixedInternalTotalSupply amount will be distributed between toDistribute addresses
        // it is addresses for team
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
        emit Transfer(address(0), address(this), _INITIAL_AMOUNT_TO_LIQUIDITY);
    }

    /* EXTERNAL FUNCTIONS */

    function addLiquidity() external payable override onlyAdmin {
        require(_isLpAdded == 0, "Exilon: Only once");
        _isLpAdded = 1;

        _startBlock = block.number;
        _startTimestamp = block.timestamp;

        uint256 amountToLiquidity = _fixedBalances[address(this)];
        delete _fixedBalances[address(this)];
        isExcludedFromDistribution[address(this)] = false;

        address _dexPairExilonWeth = dexPairExilonWeth;
        _fixedBalances[_dexPairExilonWeth] = amountToLiquidity;

        address weth = _weth;
        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).transfer(_dexPairExilonWeth, msg.value);

        IPancakePair(_dexPairExilonWeth).mint(defaultLpMintAddress);

        emit Transfer(address(this), _dexPairExilonWeth, amountToLiquidity);
        emit LiquidityAdded(msg.value);
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount)
        external
        virtual
        override
        onlyWhenLiquidityAdded
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual override onlyWhenLiquidityAdded returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "Exilon: Amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);

        _transfer(sender, recipient, amount);

        return true;
    }

    function forceLpFeesDistribute() external override onlyWhenLiquidityAdded onlyAdmin {
        PoolInfo memory poolInfo;
        poolInfo.dexPair = dexPairExilonWeth;
        poolInfo.weth = _weth;
        _distributeLpFee(address(0), 0, true, poolInfo);

        emit ForceLpFeesDistribution();
    }

    function distributeTokens(uint256 amount) external {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        require(notFixedExternalTotalSupply != 0, "Exilon: Distribution to nobody");

        if (isExcludedFromDistribution[msg.sender]) {
            uint256 fixedUserBalance = _fixedBalances[msg.sender];
            require(fixedUserBalance >= amount, "Exilon: Not enough balance");

            _notFixedBalances[msg.sender] = fixedUserBalance - amount;
            _notFixedExternalTotalSupply = notFixedExternalTotalSupply + amount;
        } else {
            uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

            uint256 notFixedUserBalance = _notFixedBalances[msg.sender];
            uint256 fixedUserBalance = (notFixedExternalTotalSupply * notFixedUserBalance) /
                notFixedInternalTotalSupply;
            require(fixedUserBalance >= amount, "Exilon: Not enough balance");

            uint256 notFixedDistributeAmount = (amount * notFixedInternalTotalSupply) /
                notFixedExternalTotalSupply;

            _notFixedBalances[msg.sender] = notFixedUserBalance - notFixedDistributeAmount;
            _notFixedInternalTotalSupply = notFixedInternalTotalSupply - notFixedDistributeAmount;
        }

        emit TokenDistribution(amount);
    }

    function excludeFromFeesDistribution(address user)
        external
        override
        onlyWhenLiquidityAdded
        onlyAdmin
    {
        require(!isExcludedFromDistribution[user], "Exilon: Already excluded");
        isExcludedFromDistribution[user] = true;

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

        emit ExcludedFromFeesDistribution(user);
    }

    function includeToFeesDistribution(address user)
        external
        override
        onlyWhenLiquidityAdded
        onlyAdmin
    {
        require(
            user != address(0xdead) &&
                user != dexPairExilonWeth &&
                user != marketingAddress &&
                user != reserveFeeAddress,
            "Exilon: Wrong address"
        );
        require(isExcludedFromDistribution[user], "Exilon: Already included");
        isExcludedFromDistribution[user] = false;

        uint256 fixedUserBalance = _fixedBalances[user];
        if (fixedUserBalance > 0) {
            uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
            uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

            uint256 notFixedUserBalance;
            if (notFixedInternalTotalSupply == 0) {
                // if there was no notFixed accounts

                // notice that
                // notFixedInternalTotalSupply != 0  <=>  notFixedExternalTotalSupply != 0
                // and
                // notFixedInternalTotalSupply == 0  <=>  notFixedExternalTotalSupply == 0

                notFixedUserBalance =
                    (fixedUserBalance * _MAX_INTERNAL_SUPPLY) /
                    _TOTAL_EXTERNAL_SUPPLY;
            } else {
                notFixedUserBalance =
                    (fixedUserBalance * notFixedInternalTotalSupply) /
                    notFixedExternalTotalSupply;
            }

            _notFixedBalances[user] = notFixedUserBalance;
            delete _fixedBalances[user];

            notFixedExternalTotalSupply += fixedUserBalance;
            _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

            notFixedInternalTotalSupply += notFixedUserBalance;
            _notFixedInternalTotalSupply = notFixedInternalTotalSupply;
        }

        emit IncludedToFeesDistribution(user);
    }

    function excludeFromPayingFees(address user) external override onlyAdmin {
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
        require(!isExcludedFromPayingFees[user], "Exilon: Already excluded");
        isExcludedFromPayingFees[user] = true;

        emit ExcludedFromPayingFees(user);
    }

    function includeToPayingFees(address user) external override onlyAdmin {
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
        require(isExcludedFromPayingFees[user], "Exilon: Already included");
        isExcludedFromPayingFees[user] = false;

        emit IncludedToPayingFees(user);
    }

    function enableLowerCommissions(address user) external override onlyAdmin {
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
        require(isHavingLowerCommissions[user], "Exilon: Already included");
        isHavingLowerCommissions[user] = false;

        emit EnabledLowerCommissions(user);
    }

    function disableLowerCommissions(address user) external override onlyAdmin {
        require(user != address(0xdead) && user != dexPairExilonWeth, "Exilon: Wrong address");
        require(isHavingLowerCommissions[user], "Exilon: Already included");
        isHavingLowerCommissions[user] = false;

        emit DisabledLowerCommissions(user);
    }

    function setWethLimitForLpFee(uint256 newValue) external override onlyAdmin {
        require(newValue <= 10 ether, "Exilon: Too big value");
        uint256 oldValue = wethLimitForLpFee;
        wethLimitForLpFee = newValue;

        emit ChangeWethLimitForLpFee(oldValue, newValue);
    }

    function setDefaultLpMintAddress(address newValue) external override onlyAdmin {
        address oldValue = defaultLpMintAddress;
        defaultLpMintAddress = newValue;

        emit ChangeDefaultLpMintAddress(oldValue, newValue);
    }

    function setWethReceiver(address value) external onlyAdmin {
        require(wethReceiver == address(0) && value != address(0), "Exilon: Only once");
        wethReceiver = value;
    }

    function setMarketingAddress(address newValue) external override onlyAdmin {
        require(isExcludedFromDistribution[newValue], "Exilon: Marketing address must be fixed");
        address oldValue = marketingAddress;
        marketingAddress = newValue;

        emit ChangeMarketingAddress(oldValue, newValue);
    }

    function setReserveFeeParameters(address _reserveFeeAddress, uint256 _reserveFee) external {
        if (_reserveFee > 0) {
            require(
                isExcludedFromDistribution[_reserveFeeAddress],
                "Exilon: Reserve fee address must be fixed"
            );
            require(
                _reserveFee <= 100, // 1%
                "Exilon: Fee too big"
            );
        }

        reserveFeeAddress = _reserveFeeAddress;
        reserveFee = _reserveFee;
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
        if (isExcludedFromDistribution[account]) {
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
        bool isFromFixed = isExcludedFromDistribution[from];
        bool isToFixed = isExcludedFromDistribution[to];

        if (isFromFixed == true && isToFixed == true) {
            _transferFromFixedToFixed(from, to, amount);
        } else if (isFromFixed == true && isToFixed == false) {
            _transferFromFixedToNotFixed(from, to, amount);
        } else if (isFromFixed == false && isToFixed == true) {
            _trasnferFromNotFixedToFixed(from, to, amount);
        } else {
            _transferFromNotFixedToNotFixed(from, to, amount);
        }
    }

    function _transferFromFixedToFixed(
        address from,
        address to,
        uint256 amount
    ) private {
        uint256 fixedBalanceFrom = _fixedBalances[from];
        require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
        _fixedBalances[from] = (fixedBalanceFrom - amount);

        address _dexPairExilonWeth = dexPairExilonWeth;
        uint256 transferAmount;
        if (from == _dexPairExilonWeth) {
            // buy tokens
            FeesInfo memory fees;
            (transferAmount, fees) = _makeBuyAction(
                _dexPairExilonWeth,
                from,
                to,
                amount,
                _notFixedInternalTotalSupply
            );

            if (fees.distributeFee > 0) {
                // Fee to distribute between users
                _notFixedExternalTotalSupply += fees.distributeFee;
            }
        } else if (to == _dexPairExilonWeth) {
            // sell tokens
            FeesInfo memory fees;
            (transferAmount, fees) = _makeSellAction(
                _dexPairExilonWeth,
                from,
                amount,
                amount >= (fixedBalanceFrom * 9) / 10,
                _notFixedInternalTotalSupply
            );

            if (fees.distributeFee > 0) {
                // Fee to distribute between users
                _notFixedExternalTotalSupply += fees.distributeFee;
            }
        } else {
            (transferAmount, ) = _makeTransferAction(_dexPairExilonWeth, from, to, amount);
        }

        _fixedBalances[to] += transferAmount;

        emit Transfer(from, to, transferAmount);
    }

    function _transferFromFixedToNotFixed(
        address from,
        address to,
        uint256 amount
    ) private {
        uint256 fixedBalanceFrom = _fixedBalances[from];
        require(fixedBalanceFrom >= amount, "Exilon: Amount exceeds balance");
        _fixedBalances[from] = (fixedBalanceFrom - amount);

        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        address _dexPairExilonWeth = dexPairExilonWeth;
        uint256 transferAmount;
        uint256 distributionAmount;
        // sell tokens cannot be because
        // dexPairExilonWeth is fixed
        if (from == _dexPairExilonWeth) {
            // buy tokens
            FeesInfo memory fees;
            (transferAmount, fees) = _makeBuyAction(
                _dexPairExilonWeth,
                from,
                to,
                amount,
                notFixedInternalTotalSupply
            );
            distributionAmount = fees.distributeFee;
        } else {
            (transferAmount, ) = _makeTransferAction(_dexPairExilonWeth, from, to, amount);
        }

        uint256 notFixedAmount;
        if (notFixedInternalTotalSupply == 0) {
            notFixedAmount = (transferAmount * _MAX_INTERNAL_SUPPLY) / _TOTAL_EXTERNAL_SUPPLY;
        } else {
            notFixedAmount =
                (transferAmount * notFixedInternalTotalSupply) /
                notFixedExternalTotalSupply;
        }
        _notFixedBalances[to] += notFixedAmount;

        notFixedExternalTotalSupply += transferAmount + distributionAmount;
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply += notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(from, to, transferAmount);
    }

    function _trasnferFromNotFixedToFixed(
        address from,
        address to,
        uint256 amount
    ) private {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        uint256 notFixedBalanceFrom = _notFixedBalances[from];
        require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
        _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);

        address _dexPairExilonWeth = dexPairExilonWeth;
        uint256 transferAmount;
        uint256 distributionAmount;
        // buy tokens cannot be because
        // dexPairExilonWeth is fixed
        if (to == _dexPairExilonWeth) {
            // sell tokens
            FeesInfo memory fees;
            (transferAmount, fees) = _makeSellAction(
                _dexPairExilonWeth,
                from,
                amount,
                amount >=
                    (((notFixedBalanceFrom * notFixedExternalTotalSupply) /
                        notFixedInternalTotalSupply) * 9) /
                        10,
                notFixedInternalTotalSupply
            );
            distributionAmount = fees.distributeFee;
        } else {
            (transferAmount, ) = _makeTransferAction(_dexPairExilonWeth, from, to, amount);
        }

        _fixedBalances[to] += transferAmount;

        notFixedExternalTotalSupply -= amount;
        notFixedExternalTotalSupply += distributionAmount;
        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;

        notFixedInternalTotalSupply -= notFixedAmount;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(from, to, transferAmount);
    }

    function _transferFromNotFixedToNotFixed(
        address from,
        address to,
        uint256 amount
    ) private {
        uint256 notFixedExternalTotalSupply = _notFixedExternalTotalSupply;
        uint256 notFixedInternalTotalSupply = _notFixedInternalTotalSupply;

        uint256 notFixedAmount = (amount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;

        uint256 notFixedBalanceFrom = _notFixedBalances[from];
        require(notFixedBalanceFrom >= notFixedAmount, "Exilon: Amount exceeds balance");
        _notFixedBalances[from] = (notFixedBalanceFrom - notFixedAmount);

        (uint256 fixedTrasnferAmount, uint256 feeAmount) = _makeTransferAction(
            dexPairExilonWeth,
            from,
            to,
            amount
        );

        uint256 notFixedFeeAmount = (feeAmount * notFixedInternalTotalSupply) /
            notFixedExternalTotalSupply;
        _notFixedBalances[to] += notFixedAmount - notFixedFeeAmount;

        notFixedExternalTotalSupply -= feeAmount;
        notFixedInternalTotalSupply -= notFixedFeeAmount;

        _notFixedExternalTotalSupply = notFixedExternalTotalSupply;
        _notFixedInternalTotalSupply = notFixedInternalTotalSupply;

        emit Transfer(from, to, fixedTrasnferAmount);
    }

    function _makeBurnAction(address from, uint256 burnFee)
        private
        returns (uint256 remainingAmount)
    {
        uint256 burnAddressBalance = _fixedBalances[address(0xdead)];
        uint256 maxBalanceInBurnAddress = (_TOTAL_EXTERNAL_SUPPLY * 6) / 10;
        if (burnAddressBalance < maxBalanceInBurnAddress) {
            uint256 burnAddressBalanceBefore = burnAddressBalance;
            burnAddressBalance += burnFee;
            if (burnAddressBalance > maxBalanceInBurnAddress) {
                remainingAmount = burnAddressBalance - maxBalanceInBurnAddress;
                burnAddressBalance = maxBalanceInBurnAddress;
            }
            _fixedBalances[address(0xdead)] = burnAddressBalance;
            emit Transfer(from, address(0xdead), burnAddressBalance - burnAddressBalanceBefore);
        } else {
            remainingAmount = burnFee;
        }
    }

    function _distributeLpFee(
        address from,
        uint256 lpFee,
        bool isForce,
        PoolInfo memory poolInfo
    ) private {
        // Fee to lp pair
        uint256 _feeAmountInTokens = feeAmountInTokens;
        if (from != address(0) && lpFee > 0) {
            emit Transfer(from, address(0), lpFee);
        }
        _feeAmountInTokens += lpFee;

        if (_feeAmountInTokens == 0) {
            return;
        }

        if (from == poolInfo.dexPair) {
            // if removing lp or buy tokens then exit
            // because dex pair is locked
            if (lpFee > 0) {
                feeAmountInTokens = _feeAmountInTokens;
            }
            return;
        }

        if (poolInfo.tokenReserves == 0) {
            poolInfo = _getDexPairInfo(poolInfo, address(this), true);
        }

        uint256 contractBalance = IERC20(poolInfo.weth).balanceOf(address(this));
        uint256 wethFeesPrice = PancakeLibrary.getAmountOut(
            _feeAmountInTokens,
            poolInfo.tokenReserves,
            poolInfo.wethReserves
        );

        if (
            wethFeesPrice == 0 ||
            (isForce == false && wethFeesPrice + contractBalance < wethLimitForLpFee)
        ) {
            if (lpFee > 0) {
                feeAmountInTokens = _feeAmountInTokens;
            }
            return;
        }

        uint256 wethAmountReturn;
        if (poolInfo.wethReserves < poolInfo.wethBalance) {
            // if in pool already weth of user
            // it can happen if user is adding lp
            wethAmountReturn = poolInfo.wethBalance - poolInfo.wethReserves;
            IPancakePair(poolInfo.dexPair).skim(address(this));
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
                if (lpFee > 0) {
                    feeAmountInTokens = _feeAmountInTokens;
                }
                return;
            }

            _fixedBalances[poolInfo.dexPair] += amountTokenToSell;
            emit Transfer(address(0), poolInfo.dexPair, amountTokenToSell);
            {
                uint256 amount0Out;
                uint256 amount1Out;
                if (poolInfo.isToken0) {
                    amount1Out = amountOfWethToBuy;
                } else {
                    amount0Out = amountOfWethToBuy;
                }
                address _wethReceiver = wethReceiver;
                IPancakePair(poolInfo.dexPair).swap(amount0Out, amount1Out, _wethReceiver, "");
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

        _fixedBalances[poolInfo.dexPair] += amountOfTokens;
        feeAmountInTokens = _feeAmountInTokens - amountOfTokens;

        emit Transfer(address(0), poolInfo.dexPair, amountOfTokens);

        IERC20(poolInfo.weth).transfer(poolInfo.dexPair, amountOfWeth);
        IPancakePair(poolInfo.dexPair).mint(defaultLpMintAddress);

        if (wethAmountReturn > 0) {
            IERC20(poolInfo.weth).transfer(poolInfo.dexPair, wethAmountReturn);
        }
    }

    function _checkBuyRestrictionsOnStart(PoolInfo memory poolInfo)
        private
        view
        returns (PoolInfo memory)
    {
        uint256 blocknumber = block.number - _startBlock;

        // [0; 60) - 0.1 BNB
        // [60; 120) - 0.3 BNB
        // [120; 180) - 0.5 BNB
        // [180; 240) - 0.7 BNB
        // [240; +inf) - unlimited

        if (blocknumber < 240) {
            if (blocknumber < 60) {
                return _checkBuyAmountCeil(poolInfo, 1 ether / 10);
            } else if (blocknumber < 120) {
                return _checkBuyAmountCeil(poolInfo, 3 ether / 10);
            } else if (blocknumber < 180) {
                return _checkBuyAmountCeil(poolInfo, 5 ether / 10);
            } else {
                return _checkBuyAmountCeil(poolInfo, 7 ether / 10);
            }
        }

        return poolInfo;
    }

    function _checkBuyAmountCeil(PoolInfo memory poolInfo, uint256 amount)
        private
        view
        returns (PoolInfo memory)
    {
        poolInfo = _getDexPairInfo(poolInfo, address(this), true);

        if (poolInfo.wethBalance >= poolInfo.wethReserves) {
            // if not removing lp
            require(
                poolInfo.wethBalance - poolInfo.wethReserves <= amount,
                "Exilon: To big buy amount"
            );
        }

        return poolInfo;
    }

    function _getDexPairInfo(
        PoolInfo memory poolInfo,
        address tokenAddress,
        bool withTrueBalance
    ) private view returns (PoolInfo memory) {
        (uint256 reserve0, uint256 reserve1, ) = IPancakePair(poolInfo.dexPair).getReserves();
        (address token0, ) = PancakeLibrary.sortTokens(tokenAddress, poolInfo.weth);
        if (token0 == tokenAddress) {
            poolInfo.tokenReserves = reserve0;
            poolInfo.wethReserves = reserve1;
            poolInfo.isToken0 = true;
        } else {
            poolInfo.wethReserves = reserve0;
            poolInfo.tokenReserves = reserve1;
            poolInfo.isToken0 = false;
        }
        if (withTrueBalance) {
            poolInfo.wethBalance = IERC20(poolInfo.weth).balanceOf(poolInfo.dexPair);
        }

        return poolInfo;
    }

    function _makeBuyAction(
        address _dexPairExilonWeth,
        address from,
        address to,
        uint256 amount,
        uint256 notFixedInternalTotalSupply
    ) private returns (uint256 transferAmount, FeesInfo memory fees) {
        PoolInfo memory poolInfo;
        poolInfo.dexPair = _dexPairExilonWeth;
        poolInfo.weth = _weth;
        poolInfo = _checkBuyRestrictionsOnStart(poolInfo);

        if (!isExcludedFromPayingFees[to]) {
            uint256 multiplier;
            if (isHavingLowerCommissions[from]) {
                multiplier = 10;
            } else {
                multiplier = 100;
            }

            fees.burnFee = (amount * multiplier) / 10000;
            fees.marketingFee = (amount * 2 * multiplier) / 10000;

            fees.reserveFee = (amount * reserveFee * multiplier) / (10000 * 100);

            if (notFixedInternalTotalSupply == 0) {
                fees.lpFee = (amount * 9 * multiplier) / 10000;
            } else {
                fees.distributeFee = (amount * multiplier) / 10000;
                fees.lpFee = (amount * 8 * multiplier) / 10000;
            }
        }

        uint256 additionalToLp;
        if (fees.burnFee > 0) {
            additionalToLp = _makeBurnAction(from, fees.burnFee);
        }

        if (fees.marketingFee > 0) {
            address _marketingAddress = marketingAddress;
            _fixedBalances[_marketingAddress] += fees.marketingFee;

            emit Transfer(from, _marketingAddress, fees.marketingFee);
        }

        if (fees.lpFee > 0) {
            _distributeLpFee(from, fees.lpFee + additionalToLp, false, poolInfo);
        }

        if (fees.reserveFee > 0) {
            _fixedBalances[reserveFeeAddress] += fees.reserveFee;
        }

        transferAmount =
            amount -
            fees.burnFee -
            fees.lpFee -
            fees.distributeFee -
            fees.marketingFee -
            fees.reserveFee;
    }

    function _makeSellAction(
        address _dexPairExilonWeth,
        address from,
        uint256 amount,
        bool isSellingBig,
        uint256 notFixedInternalTotalSupply
    ) private returns (uint256 transferAmount, FeesInfo memory fees) {
        if (!isExcludedFromPayingFees[from]) {
            uint256 multiplier;
            if (isHavingLowerCommissions[from]) {
                multiplier = 10;
            } else {
                multiplier = 100;
            }

            fees.burnFee = (amount * multiplier) / 10000;
            fees.marketingFee = (amount * 2 * multiplier) / 10000;

            fees.reserveFee = (amount * reserveFee * multiplier) / (10000 * 100);

            uint256 timeFromStart = block.timestamp - _startTimestamp;
            if (timeFromStart < 30 minutes) {
                if (isSellingBig) {
                    fees.lpFee = 16;
                } else {
                    fees.lpFee = 14;
                }
            } else if (timeFromStart < 60 minutes) {
                if (isSellingBig) {
                    fees.lpFee = 13;
                } else {
                    fees.lpFee = 11;
                }
            } else {
                if (isSellingBig) {
                    fees.lpFee = 10;
                } else {
                    fees.lpFee = 8;
                }
            }

            if (notFixedInternalTotalSupply == 0) {
                fees.lpFee = ((fees.lpFee + 1) * amount * multiplier) / 10000;
            } else {
                fees.lpFee = (fees.lpFee * amount * multiplier) / 10000;
                fees.distributeFee = (amount * multiplier) / 10000;
            }
        }

        uint256 additionalToLp;
        if (fees.burnFee > 0) {
            additionalToLp = _makeBurnAction(from, fees.burnFee);
        }

        if (fees.marketingFee > 0) {
            address _marketingAddress = marketingAddress;
            _fixedBalances[_marketingAddress] += fees.marketingFee;

            emit Transfer(from, _marketingAddress, fees.marketingFee);
        }

        if (fees.lpFee > 0) {
            PoolInfo memory poolInfo;
            poolInfo.dexPair = _dexPairExilonWeth;
            poolInfo.weth = _weth;
            _distributeLpFee(from, fees.lpFee + additionalToLp, false, poolInfo);
        }

        if (fees.reserveFee > 0) {
            _fixedBalances[reserveFeeAddress] += fees.reserveFee;
        }

        transferAmount =
            amount -
            fees.burnFee -
            fees.lpFee -
            fees.distributeFee -
            fees.marketingFee -
            fees.reserveFee;
    }

    function _makeTransferAction(
        address _dexPairExilonWeth,
        address from,
        address to,
        uint256 amount
    ) private returns (uint256 transferAmount, uint256 feeAmount) {
        if (isExcludedFromPayingFees[from] || isExcludedFromPayingFees[to]) {
            return (amount, 0);
        }

        if (Address.isContract(to)) {
            try IPancakePair(to).factory() returns (address) {
                // make sure
                try IPancakePair(to).token0() returns (address) {
                    revert("Not allowed creating new LP pairs of this token");
                } catch (bytes memory) {}
            } catch (bytes memory) {}
        }

        PoolInfo memory poolInfoExilon;
        poolInfoExilon.dexPair = _dexPairExilonWeth;
        poolInfoExilon.weth = _weth;
        poolInfoExilon = _getDexPairInfo(poolInfoExilon, address(this), false);

        PoolInfo memory poolInfoUsd;
        poolInfoUsd.dexPair = dexPairUsdWeth;
        poolInfoUsd.weth = poolInfoExilon.weth;
        poolInfoUsd = _getDexPairInfo(poolInfoUsd, usdAddress, false);

        uint256 amountWethNeeded = PancakeLibrary.getAmountIn(
            feeAmountInUsd,
            poolInfoUsd.wethReserves,
            poolInfoUsd.tokenReserves
        );
        feeAmount = PancakeLibrary.getAmountIn(
            amountWethNeeded,
            poolInfoExilon.tokenReserves,
            poolInfoExilon.wethReserves
        );

        require(amount > feeAmount, "Exilon: Small transfer amount (not more than fee)");
        transferAmount = amount - feeAmount;

        address _marketingAddress = marketingAddress;
        _fixedBalances[_marketingAddress] += feeAmount;

        emit Transfer(from, _marketingAddress, feeAmount);
    }
}
