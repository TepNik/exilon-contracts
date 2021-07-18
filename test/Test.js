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

const DECIMALS = EIGHT;
const ONE_TOKEN = TEN.pow(DECIMALS);
const ONE_ETH = TEN.pow(EIGHTEEN);

const NAME = "Exilon";
const SYMBOL = "XLN";
const TOTAL_SUPPLY = (new BN("2500000000000")).mul(ONE_TOKEN);

const minEthLiquidity = ONE_ETH.mul(TEN).mul(TEN);
const maxEthLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN).mul(TEN);
const minTokenLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN);
const maxTokenLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN).mul(TEN).mul(TEN).mul(TEN);

const PancakeFactory = contract.fromArtifact('PancakeFactory');
const PancakePair = contract.fromArtifact('PancakePair');
const PancakeRouter = contract.fromArtifact('PancakeRouter');
const WETH = contract.fromArtifact('WETH');

const Exilon = contract.fromArtifact('Exilon');

let PancakeFactoryInst;
let PancakeRouterInst;
let WETHInst;
let ExilonInst;
let ExilonDexPairInst;

describe('Exilon test', () => {
    const [
        feeToSetter,
        exilonAdmin,
        distributionAddress1,
        distributionAddress2,
        distributionAddress3,
        distributionAddress4,
        user1,
        user2,
        user3,
        user4
    ] = accounts;

    let defaultAdminRole;

    beforeEach(async () => {
        WETHInst = await WETH.new();
        PancakeFactoryInst = await PancakeFactory.new(feeToSetter);
        PancakeRouterInst = await PancakeRouter.new(PancakeFactoryInst.address, WETHInst.address);

        ExilonInst = await Exilon.new(
            PancakeRouterInst.address,
            [
                distributionAddress1,
                distributionAddress2,
                distributionAddress3,
                distributionAddress4
            ],
            { from: exilonAdmin }
        );

        ExilonDexPairInst = await PancakePair.at(
            await PancakeFactoryInst.getPair(WETHInst.address, ExilonInst.address)
        );

        defaultAdminRole = await ExilonInst.DEFAULT_ADMIN_ROLE();
    })

    it("Deploy test", async () => {
        expect(await ExilonInst.dexRouter()).to.be.equals(PancakeRouterInst.address);
        expect(await ExilonInst.dexPair()).to.be.equals(ExilonDexPairInst.address);

        expect(await ExilonInst.name()).to.be.equals(NAME);
        expect(await ExilonInst.symbol()).to.be.equals(SYMBOL);
        expect(await ExilonInst.decimals()).to.be.bignumber.equals(DECIMALS);

        expect(await ExilonInst.totalSupply()).to.be.bignumber.equals(TOTAL_SUPPLY);

        expect(await ExilonInst.hasRole(defaultAdminRole, exilonAdmin)).to.be.true;

        let amountToLiqidity = TOTAL_SUPPLY.mul(EIGHT).div(TEN);
        expect(await ExilonInst.balanceOf(ExilonInst.address)).to.be.bignumber.equals(amountToLiqidity);

        let amountToDistribution = TOTAL_SUPPLY.sub(amountToLiqidity);
        isNear(await ExilonInst.balanceOf(distributionAddress1), amountToDistribution.div(FOUR));
        isNear(await ExilonInst.balanceOf(distributionAddress2), amountToDistribution.div(FOUR));
        isNear(await ExilonInst.balanceOf(distributionAddress3), amountToDistribution.div(FOUR));
        isNear(await ExilonInst.balanceOf(distributionAddress4), amountToDistribution.div(FOUR));
    })

    it("Add first liqiudity", async () => {
        await expectRevert(
            ExilonInst.addLiquidity({ from: user1 }),
            "Exilon: Sender is not admin"
        );
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
        await expectRevert(
            ExilonInst.addLiquidity({ from: exilonAdmin }),
            "Exilon: Only once"
        );

        expect(await ExilonInst.balanceOf(ExilonDexPairInst.address)).to.be.bignumber.equals(TOTAL_SUPPLY.mul(EIGHT).div(TEN));
        expect(await WETHInst.balanceOf(ExilonDexPairInst.address)).to.be.bignumber.equals(ONE_ETH);

        let lpTotalSupply = await ExilonDexPairInst.totalSupply();
        let minimumLiqiudity = await ExilonDexPairInst.MINIMUM_LIQUIDITY();
        expect(await ExilonDexPairInst.balanceOf(exilonAdmin)).to.be.bignumber.equals(lpTotalSupply.sub(minimumLiqiudity));
    })

    it("Test addLiquidity restrictions", async () => {
        await expectRevert(
            ExilonInst.transfer(distributionAddress2, ZERO, { from: distributionAddress1 }),
            "Exilon: Liquidity not added"
        );
        await expectRevert(
            ExilonInst.transferFrom(distributionAddress2, distributionAddress1, ZERO, { from: distributionAddress1 }),
            "Exilon: Liquidity not added"
        );

        await expectRevert(
            ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Liquidity not added"
        );
        await expectRevert(
            ExilonInst.includeToFeesDistribution(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Liquidity not added"
        );
    })

    it("Test transferFrom function", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });

        let balance = await ExilonInst.balanceOf(distributionAddress1);

        await expectRevert(
            ExilonInst.transferFrom(distributionAddress1, distributionAddress2, balance, { from: distributionAddress2 }),
            "Exilon: Amount exceeds allowance"
        );
        await ExilonInst.approve(distributionAddress2, balance.sub(ONE), { from: distributionAddress1 });
        await expectRevert(
            ExilonInst.transferFrom(distributionAddress1, distributionAddress2, balance, { from: distributionAddress2 }),
            "Exilon: Amount exceeds allowance"
        );
        await ExilonInst.approve(distributionAddress2, balance, { from: distributionAddress1 });
        await ExilonInst.transferFrom(distributionAddress1, distributionAddress2, balance, { from: distributionAddress2 });
    })

    it("Test transfers between not fixed addresses", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });

        // test transfer function

        // test trasnfer of full balance
        let balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        let balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress2, balance1Before, { from: distributionAddress1 });

        let balance1After = await ExilonInst.balanceOf(distributionAddress1);
        let balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance1After).to.be.bignumber.equals(ZERO);
        isNear(balance2After.sub(balance2Before), balance1Before);

        // test transfer of half balance
        balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress1, balance2Before.div(TWO), { from: distributionAddress2 });

        balance1After = await ExilonInst.balanceOf(distributionAddress1);
        balance2After = await ExilonInst.balanceOf(distributionAddress2);

        isNear(balance1After, balance2Before.div(TWO));
        isNear(balance2After, balance2Before.sub(balance2Before.div(TWO)));
    })

    it("Test transfers between fixed addresses", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });

        // make them fixed
        await ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin });
        await ExilonInst.excludeFromFeesDistribution(distributionAddress2, { from: exilonAdmin });

        // test transfer function

        // test trasnfer of full balance
        let balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        let balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress2, balance1Before, { from: distributionAddress1 });

        let balance1After = await ExilonInst.balanceOf(distributionAddress1);
        let balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance1After).to.be.bignumber.equals(ZERO);
        expect(balance2After.sub(balance2Before)).to.be.bignumber.equals(balance1Before);

        // test transfer of half balance
        balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress1, balance2Before.div(TWO), { from: distributionAddress2 });

        balance1After = await ExilonInst.balanceOf(distributionAddress1);
        balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance1After).to.be.bignumber.equals(balance2Before.div(TWO));
        expect(balance2After).to.be.bignumber.equals(balance2Before.sub(balance2Before.div(TWO)));
    })

    it("Test transfers between not fixed and fixed addresses", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });

        // make distributionAddress1 address fixed
        await ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin });

        // test transfer function

        // test trasnfer of full balance from fixed to not fixed
        let balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        let balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress2, balance1Before, { from: distributionAddress1 });

        let balance1After = await ExilonInst.balanceOf(distributionAddress1);
        let balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance1After).to.be.bignumber.equals(ZERO);
        isNear(balance2After.sub(balance2Before), balance1Before);

        // test trasnfer of full balance from not fixed to fixed
        balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress1, balance2Before, { from: distributionAddress2 });

        balance1After = await ExilonInst.balanceOf(distributionAddress1);
        balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance2After).to.be.bignumber.equals(ZERO);
        isNear(balance1After.sub(balance1Before), balance2Before);

        // give back balance to distributionAddress2
        await ExilonInst.transfer(distributionAddress2, (await ExilonInst.balanceOf(distributionAddress1)).div(TWO), { from: distributionAddress1 });

        // test transfer of half balance from fixed to not fixed
        balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress2, balance1Before.div(TWO), { from: distributionAddress1 });

        balance1After = await ExilonInst.balanceOf(distributionAddress1);
        balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance1After).to.be.bignumber.equals(balance1Before.sub(balance1Before.div(TWO)));
        isNear(balance2After.sub(balance2Before), balance1Before.div(TWO));

        // test transfer of half balance from not fixed to fixed
        balance1Before = await ExilonInst.balanceOf(distributionAddress1);
        balance2Before = await ExilonInst.balanceOf(distributionAddress2);

        await ExilonInst.transfer(distributionAddress1, balance2Before.div(TWO), { from: distributionAddress2 });

        balance1After = await ExilonInst.balanceOf(distributionAddress1);
        balance2After = await ExilonInst.balanceOf(distributionAddress2);

        expect(balance1After.sub(balance1Before)).to.be.bignumber.equals(balance2Before.div(TWO));
        isNear(balance2Before.sub(balance2After), balance2Before.div(TWO));
    })

    it("Test exludeFromFeesDistribution and includeToFeesDistribution", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });


        await expectRevert(
            ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: distributionAddress1 }),
            "Exilon: Sender is not admin"
        );

        // test exclude from fees distribution
        let balanceBefore = await ExilonInst.balanceOf(distributionAddress1);

        await ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already excluded"
        );

        let balanceAfter = await ExilonInst.balanceOf(distributionAddress1);

        expect(balanceAfter).to.be.bignumber.equals(balanceBefore);

        // test include in fees distribution
        balanceBefore = await ExilonInst.balanceOf(distributionAddress1);

        await ExilonInst.includeToFeesDistribution(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.includeToFeesDistribution(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already included"
        );

        balanceAfter = await ExilonInst.balanceOf(distributionAddress1);

        isNear(balanceAfter, balanceBefore);
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

function isNear(x, y) {
    expect(x.sub(y).abs()).to.be.bignumber.below(TWO);
}

function getRandomBN() {
    const random = randomBytes(32);
    return new BN(random.toString('hex'));
}

function getRandomBNFromTo(from, to) {
    const randomBN = getRandomBN();
    const delta = to.sub(from);
    return randomBN.mod(delta).add(from);
}