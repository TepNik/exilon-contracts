const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const {
    BN,
    constants,
    expectEvent,
    expectRevert,
    time,
    balance
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { randomBytes } = require('crypto');

require('dotenv').config();
const {
} = process.env;

const MINUS_ONE = new BN(-1);
const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);
const FOUR = new BN(4);
const FIVE = new BN(5);
const SIX = new BN(6);
const SEVEN = new BN(7);
const EIGHT = new BN(8);
const NINE = new BN(9);
const TEN = new BN(10);
const EIGHTEEN = new BN(18);

const DECIMALS = EIGHTEEN;
const ONE_TOKEN = TEN.pow(DECIMALS);
const ONE_ETH = TEN.pow(EIGHTEEN);

const minEthLiquidity = ONE_ETH.mul(TEN).mul(TEN);
const maxEthLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN).mul(TEN);
const minTokenLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN);
const maxTokenLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN).mul(TEN).mul(TEN).mul(TEN);

const PancakeFactory = contract.fromArtifact('PancakeFactory');
const PancakePair = contract.fromArtifact('PancakePair');
const PancakeRouter = contract.fromArtifact('PancakeRouter');
const WETH = contract.fromArtifact('WETH');

const TestContract = contract.fromArtifact('TestContract');

let PancakeFactoryInst;
let PancakeRouterInst;
let WETHInst;
let TestContractInst;

describe('Test', () => {
    const [
        feeToSetter
    ] = accounts;

    beforeEach(async () => {
        WETHInst = await WETH.new();
        PancakeFactoryInst = await PancakeFactory.new(feeToSetter);
        PancakeRouterInst = await PancakeRouter.new(PancakeFactoryInst.address, WETHInst.address);

        TestContractInst = await TestContract.new();
    })

    it("Deploy test", async () => {
        console.log("Address =", TestContractInst.address);
    })



    async function addLiqudity(token, receiver) {
        const tokensToLiquidity = getRandomBNFromTo(minTokenLiquidity, maxTokenLiquidity);
        const ethToLiquidity = getRandomBNFromTo(minEthLiquidity, maxEthLiquidity);

        if (token == WETHInst || token == constants.ZERO_ADDRESS) {
            return;
        }
        await token.mint(tokensToLiquidity);
        await token.approve(PancakeRouterInst.address, tokensToLiquidity);

        await PancakeRouterInst.addLiquidityETH(token.address, tokensToLiquidity, ZERO, ZERO, receiver, 10000000000000, { value: ethToLiquidity });
    }

    async function changePriceToken(token, receiver) {
        const tokensToLiquidity = getRandomBNFromTo(minTokenLiquidity, maxTokenLiquidity).div(TEN).div(TEN);
        const ethToLiquidity = getRandomBNFromTo(minEthLiquidity, maxEthLiquidity).div(TEN).div(TEN);

        if (token == WETHInst || token == constants.ZERO_ADDRESS) {
            return;
        }
        const pair = await PancakePair.at(await PancakeFactoryInst.getPair(token.address, WETHInst.address));

        await token.mint(tokensToLiquidity);
        await token.transfer(pair.address, tokensToLiquidity);
        await WETHInst.deposit({ value: ethToLiquidity });
        await WETHInst.transfer(pair.address, ethToLiquidity);

        await pair.mint(receiver);
    }

    async function getBalance(token, user) {
        if (token == constants.ZERO_ADDRESS) {
            return new BN(await web3.eth.getBalance(user));
        } else {
            return await token.balanceOf(user);
        }
    }

    async function getTokensPrices(tokens) {
        const res = [];
        for (let i = 0; i < tokens.length; ++i) {
            if (tokens[i] == WETHInst.address || tokens[i] == constants.ZERO_ADDRESS) {
                res[i] = ONE_ETH;
            } else {
                const pair = await PancakePair.at(await PancakeFactoryInst.getPair(tokens[i], WETHInst.address));
                let tokenReserves;
                let wethReserves;
                let temp = await pair.getReserves();
                if ((await pair.token0()) == tokens[i]) {
                    tokenReserves = temp[0];
                    wethReserves = temp[1];
                } else {
                    tokenReserves = temp[1];
                    wethReserves = temp[0];
                }
                res[i] = await PancakeRouterInst.getAmountIn(ONE_TOKEN, wethReserves, tokenReserves);
            }
        }
        return res;
    }

    async function getWethTokenPrice(token, amount, outputToken) {
        if (outputToken == undefined) {
            outputToken = WETHInst.address;
        }
        let res;
        if (isEth(outputToken) && isEth(token)) {
            res = amount;
        } else if (outputToken == token) {
            res = amount;
        } else {
            let path = [];
            if (isEth(token)) {
                path = [ifEthReturnWeth(token), outputToken];
                res = await PancakeRouterInst.getAmountsOut(amount, path);
                res = res[res.length - 1];
            } else if (isEth(outputToken)) {
                path = [token, ifEthReturnWeth(outputToken)];
                res = await PancakeRouterInst.getAmountsOut(amount, path);
                res = res[res.length - 1];
            } else {
                path = [token, WETHInst.address];
                res = await PancakeRouterInst.getAmountsOut(amount, path);
                amount = res[res.length - 1];
                path = [WETHInst.address, outputToken];
                res = await PancakeRouterInst.getAmountsOut(amount, path);
                res = amount.add(res[res.length - 1]);
            }
        }
        return res;
    }

    function isEth(token) {
        if (token == WETHInst.address || token == constants.ZERO_ADDRESS) {
            return true;
        } else {
            return false;
        }
    }

    function ifEthReturnWeth(token) {
        if (token == WETHInst.address || token == constants.ZERO_ADDRESS) {
            return WETHInst.address;
        } else {
            return token;
        }
    }

    function printLogs(logs) {
        console.log("logs =");
        for (let i = 0; i < logs.length; ++i) {
            console.log(i, "=", logs[i].event);
            for (let j = 0; j < logs[i].args.__length__; ++j) {
                let arg = logs[i].args[j];
                if (arg.toString) {
                    arg = arg.toString();
                } else if (arg.length) {
                    for (let z = 0; z < arg.length; ++z) {
                        arg[z] = arg[z].toString();
                    }
                }
                console.log("j =", j, "; arg =", arg);
            }
        }
    }

    function findLog(logs, name) {
        for (let i = 0; i < logs.length; ++i) {
            if (logs[i].event == name) {
                return logs[i].args;
            }
            console.log(i, "=", logs[i].event);
            for (let j = 0; j < logs[i].args.__length__; ++j) {
                let arg = logs[i].args[j];
                if (arg.toString) {
                    arg = arg.toString();
                } else if (arg.length) {
                    for (let z = 0; z < arg.length; ++z) {
                        arg[z] = arg[z].toString();
                    }
                }
                console.log("j =", j, "; arg =", arg);
            }
        }
    }
})

function getRandomBN() {
    const random = randomBytes(32);
    return new BN(random.toString('hex'));
}

function getRandomBNFromTo(from, to) {
    const randomBN = getRandomBN();
    const delta = to.sub(from);
    return randomBN.mod(delta).add(from);
}