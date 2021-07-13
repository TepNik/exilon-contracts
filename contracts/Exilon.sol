// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./pancake-swap/interfaces/IPancakeRouter02.sol";
import "./pancake-swap/interfaces/IPancakeFactory.sol";

contract Exilon is IERC20, IERC20Metadata, AccessControl {
    /* STATE VARIABLES */

    // public data

    IPancakeRouter02 public immutable dexRouter;
    address public immutable dexPair;

    // private data

    uint8 private _decimals = 18;

    string private _name = "Exilon";
    string private _symbol = "XLN";

    mapping(address => mapping(address => uint256)) private _allowances;

    // extTotal - "external" balance
    uint256 private _extTotal = 2500 * 10**9 * 10**_decimals;
    // intTotal - "internal" balance
    uint256 private _intTotal = (type(uint256).max - (type(uint256).max % _extTotal));
    // 0 - not added; 1 - added
    uint256 private isLpAdded;

    /* MODIFIERS */

    modifier onlyWhenLiquidityAdded {
        require(isLpAdded == 1, "Exilon: Liquidity not added");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Exilon: Sender is not admin");
        _;
    }

    /* EVENTS */

    /* FUNCTIONS */

    // solhint-disable-next-line func-visibility
    constructor(IPancakeRouter02 _dexRouter) {
        IPancakeFactory dexFactory = IPancakeFactory(_dexRouter.factory());
        address weth = _dexRouter.WETH();
        dexPair = dexFactory.createPair(address(this), weth);

        dexRouter = _dexRouter;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
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

    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual override returns (bool) {
        uint256 currentAllowance = _allowances[sender][_msgSender()];
        require(currentAllowance >= amount, "Exilon: Amount exceeds allowance");
        unchecked {
            _approve(sender, _msgSender(), currentAllowance - amount);
        }

        _transfer(sender, recipient, amount);

        return true;
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
        return _extTotal;
    }

    function balanceOf(address account) external view virtual override returns (uint256) {
        revert("Exilon: Not implemented");
        return 0;
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
        revert("Exilon: Not implemented");
    }
}
