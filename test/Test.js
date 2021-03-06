const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
    BN,
    constants,
    expectEvent,
    expectRevert,
    time,
    balance,
    send,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { randomBytes } = require("crypto");

require("dotenv").config();
const {} = process.env;

// set 'true' if want to see gas usage
let testsWithOutput = false;

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
const ONE_HUNDRED = new BN(100);

const DECIMALS = SIX;
const ONE_TOKEN = TEN.pow(DECIMALS);
const ONE_ETH = TEN.pow(EIGHTEEN);

const DEADLINE = new BN("10000000000000000000");
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const NAME = "Exilon";
const SYMBOL = "EXL";
const TOTAL_SUPPLY = new BN("5000000000000").mul(ONE_TOKEN);

const AMOUNT_TO_LIQUIDITY = new BN("40");

const FIRST_AMOUNT = ONE_ETH.div(TEN);
const STEP_AMOUNT = ONE_ETH.div(TEN).mul(TWO);
const STEP_DELTA_BLOCK = [new BN(60), new BN(60), new BN(60), new BN(60)];

const usdTokenLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN);
const usdWethLiquidity = ONE_ETH.mul(TEN).mul(TEN).mul(TEN).mul(TEN);

const PancakeFactory = contract.fromArtifact("PancakeFactory");
const PancakePair = contract.fromArtifact("PancakePair");
const PancakeRouter = contract.fromArtifact("PancakeRouter");
const WETH = contract.fromArtifact("WETH");

const ERC20Test = contract.fromArtifact("ERC20Test");

const Exilon = contract.fromArtifact("ExilonTest");
const WethReceiver = contract.fromArtifact("wethReceiver");

let PancakeFactoryInst;
let PancakeRouterInst;
let WETHInst;
let UsdTokenInst;
let UsdWethPairInst;
let ExilonInst;
let ExilonDexPairInst;
let WethReceiverInst;

let fixedAddresses = [];
let notFixedAddresses = [];

describe("Exilon contract tests", () => {
    const [
        feeToSetter,
        exilonAdmin,
        marketingAddress,
        defaultLpMintAddress,
        distributionAddress1,
        distributionAddress2,
        distributionAddress3,
        distributionAddress4,
        distributionAddress5,
        distributionAddress6,
        distributionAddress7,
        distributionAddress8,
    ] = accounts;

    let defaultAdminRole;
    let liquidityAmount = ONE_ETH.mul(new BN("8000000000000"));

    beforeEach(async () => {
        WETHInst = await WETH.new();
        PancakeFactoryInst = await PancakeFactory.new(feeToSetter);
        PancakeRouterInst = await PancakeRouter.new(PancakeFactoryInst.address, WETHInst.address);

        UsdTokenInst = await ERC20Test.new();
        await UsdTokenInst.mint(usdTokenLiquidity);
        await UsdTokenInst.approve(PancakeRouterInst.address, usdTokenLiquidity);
        await PancakeRouterInst.addLiquidityETH(
            UsdTokenInst.address,
            usdTokenLiquidity,
            ZERO,
            ZERO,
            defaultLpMintAddress,
            DEADLINE,
            { value: usdWethLiquidity }
        );
        UsdWethPairInst = await PancakePair.at(
            await PancakeFactoryInst.getPair(WETHInst.address, UsdTokenInst.address)
        );

        ExilonInst = await Exilon.new(
            PancakeRouterInst.address,
            UsdTokenInst.address,
            [
                distributionAddress1,
                distributionAddress2,
                distributionAddress3,
                distributionAddress4,
                distributionAddress5,
                distributionAddress6,
                distributionAddress7,
                distributionAddress8,
            ],
            defaultLpMintAddress,
            marketingAddress,
            { from: exilonAdmin }
        );

        WethReceiverInst = await WethReceiver.new(ExilonInst.address);
        await ExilonInst.setWethReceiver(WethReceiverInst.address, { from: exilonAdmin });

        ExilonDexPairInst = await PancakePair.at(
            await PancakeFactoryInst.getPair(WETHInst.address, ExilonInst.address)
        );

        fixedAddresses = [];
        fixedAddresses.push(ExilonDexPairInst.address);
        fixedAddresses.push(BURN_ADDRESS);
        fixedAddresses.push(marketingAddress);

        notFixedAddresses = [];
        notFixedAddresses.push(exilonAdmin);
        notFixedAddresses.push(defaultLpMintAddress);
        notFixedAddresses.push(distributionAddress1);
        notFixedAddresses.push(distributionAddress2);
        notFixedAddresses.push(distributionAddress3);
        notFixedAddresses.push(distributionAddress4);
        notFixedAddresses.push(distributionAddress5);
        notFixedAddresses.push(distributionAddress6);
        notFixedAddresses.push(distributionAddress7);
        notFixedAddresses.push(distributionAddress8);

        defaultAdminRole = await ExilonInst.DEFAULT_ADMIN_ROLE();
    });

    it("Deploy test", async () => {
        expect(await ExilonInst.dexRouter()).to.be.equals(PancakeRouterInst.address);
        expect(await ExilonInst.dexPairExilonWeth()).to.be.equals(ExilonDexPairInst.address);
        expect(await ExilonInst.dexPairUsdWeth()).to.be.equals(UsdWethPairInst.address);

        expect(await ExilonInst.wethReceiver()).to.be.equals(WethReceiverInst.address);
        expect(await ExilonInst.defaultLpMintAddress()).to.be.equals(defaultLpMintAddress);

        expect(await ExilonInst.name()).to.be.equals(NAME);
        expect(await ExilonInst.symbol()).to.be.equals(SYMBOL);
        expect(await ExilonInst.decimals()).to.be.bignumber.equals(DECIMALS);

        expect(await ExilonInst.totalSupply()).to.be.bignumber.equals(TOTAL_SUPPLY);

        expect(await ExilonInst.wethLimitForLpFee()).to.be.bignumber.equals(ONE.mul(ONE_ETH));

        expect(await ExilonInst.hasRole(defaultAdminRole, exilonAdmin)).to.be.true;

        let amountToLiqidity = TOTAL_SUPPLY.mul(AMOUNT_TO_LIQUIDITY).div(ONE_HUNDRED);
        expect(await ExilonInst.balanceOf(ExilonInst.address)).to.be.bignumber.equals(
            amountToLiqidity
        );

        expect(await ExilonInst.balanceOf(exilonAdmin)).to.be.bignumber.equals(ZERO);

        let amountToDistribution = TOTAL_SUPPLY.sub(amountToLiqidity);
        isNear(await ExilonInst.balanceOf(distributionAddress1), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress2), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress3), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress4), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress5), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress6), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress7), amountToDistribution.div(EIGHT));
        isNear(await ExilonInst.balanceOf(distributionAddress8), amountToDistribution.div(EIGHT));
    });

    it("addLiquidity()", async () => {
        await expectRevert(
            ExilonInst.transfer(distributionAddress2, ZERO, { from: distributionAddress1 }),
            "Exilon: Liquidity not added"
        );
        await expectRevert(
            ExilonInst.transferFrom(distributionAddress2, distributionAddress1, ZERO, {
                from: distributionAddress1,
            }),
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

        await expectRevert(
            ExilonInst.forceLpFeesDistribute({ from: exilonAdmin }),
            "Exilon: Liquidity not added"
        );

        await expectRevert.unspecified(ExilonInst.addLiquidity({ from: distributionAddress1 }));
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
        await expectRevert(ExilonInst.addLiquidity({ from: exilonAdmin }), "Exilon: Only once");

        expect(await ExilonInst.balanceOf(ExilonDexPairInst.address)).to.be.bignumber.equals(
            TOTAL_SUPPLY.mul(AMOUNT_TO_LIQUIDITY).div(ONE_HUNDRED)
        );
        expect(await WETHInst.balanceOf(ExilonDexPairInst.address)).to.be.bignumber.equals(ONE_ETH);

        let lpTotalSupply = await ExilonDexPairInst.totalSupply();
        let minimumLiqiudity = await ExilonDexPairInst.MINIMUM_LIQUIDITY();
        expect(await ExilonDexPairInst.balanceOf(defaultLpMintAddress)).to.be.bignumber.equals(
            lpTotalSupply.sub(minimumLiqiudity)
        );
    });

    describe("transfer()", () => {
        it("transferFrom()", async () => {
            await ExilonInst.addLiquidity({
                from: exilonAdmin,
                value: liquidityAmount,
            });

            let balance = await ExilonInst.balanceOf(distributionAddress1);

            await expectRevert(
                ExilonInst.transferFrom(distributionAddress1, distributionAddress2, balance, {
                    from: distributionAddress2,
                }),
                "Exilon: Amount exceeds allowance"
            );
            await ExilonInst.approve(distributionAddress2, balance.sub(ONE), {
                from: distributionAddress1,
            });
            await expectRevert(
                ExilonInst.transferFrom(distributionAddress1, distributionAddress2, balance, {
                    from: distributionAddress2,
                }),
                "Exilon: Amount exceeds allowance"
            );
            await ExilonInst.approve(distributionAddress2, balance, { from: distributionAddress1 });
            await ExilonInst.transferFrom(distributionAddress1, distributionAddress2, balance, {
                from: distributionAddress2,
            });
            expect(
                await ExilonInst.allowance(distributionAddress1, distributionAddress2)
            ).to.be.bignumber.equals(ZERO);
        });

        it("To new LP pair", async () => {
            await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });

            await PancakeFactoryInst.createPair(ExilonInst.address, UsdTokenInst.address);

            let newPair = await PancakeFactoryInst.getPair(
                UsdTokenInst.address,
                ExilonInst.address
            );

            await expectRevert(
                ExilonInst.transfer(newPair, ONE, { from: distributionAddress1 }),
                "Not allowed creating new LP pairs of this token"
            );
        });

        describe("No fees", () => {
            it("Between not fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin });
                await ExilonInst.excludeFromPayingFees(distributionAddress2, { from: exilonAdmin });

                // test transfer function

                // test trasnfer of full balance
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress2,
                    await ExilonInst.balanceOf(distributionAddress1),
                    false
                );

                // test trasnfer of part balance
                await checkTransfer(
                    distributionAddress2,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress2)).div(THREE),
                    false
                );
            });

            it("Between fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress5, { from: exilonAdmin });
                await ExilonInst.excludeFromPayingFees(distributionAddress6, { from: exilonAdmin });

                // test transfer function

                // test trasnfer of full balance
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress6,
                    await ExilonInst.balanceOf(distributionAddress5),
                    false
                );

                // test transfer part of balance
                await checkTransfer(
                    distributionAddress6,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress6)).div(THREE),
                    false
                );
            });

            it("Between not fixed and fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress5, { from: exilonAdmin });
                await ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin });

                // test transfer function

                // test trasnfer of full balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    await ExilonInst.balanceOf(distributionAddress5),
                    false
                );

                // test trasnfer of full balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress1),
                    false
                );

                // test transfer less than half balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    false
                );

                // test transfer of half balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    false
                );
            });
        });

        describe("With fees", () => {
            it("Between not fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                // test transfer function

                // test trasnfer of full balance
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress2,
                    await ExilonInst.balanceOf(distributionAddress1),
                    true
                );

                // test trasnfer of part balance
                await checkTransfer(
                    distributionAddress2,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress2)).div(THREE),
                    true
                );
            });

            it("Between fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                // test transfer function

                // test trasnfer of full balance
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress6,
                    await ExilonInst.balanceOf(distributionAddress5),
                    true
                );

                // test transfer part of balance
                await checkTransfer(
                    distributionAddress6,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress6)).div(THREE),
                    true
                );
            });

            it("Between not fixed and fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                // test transfer function

                // test trasnfer of full balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    await ExilonInst.balanceOf(distributionAddress5),
                    true
                );

                // test trasnfer of full balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress1),
                    true
                );

                // test transfer less than half balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    true
                );

                // test transfer of half balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    true
                );
            });
        });
    });

    describe("Dex buy and sell", () => {
        it("Check buy restrictions on start", async () => {
            let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
            let blocknumber = new BN(tx.receipt.blockNumber);

            let blockNow = blocknumber;
            for (let i = 0; i < STEP_DELTA_BLOCK.length; ++i) {
                let sellAmount = restrictionsOnStart(blockNow.sub(blocknumber));
                await time.advanceBlockTo(blockNow);

                await expectRevert(
                    PancakeRouterInst.swapExactETHForTokens(
                        ZERO,
                        [WETHInst.address, ExilonInst.address],
                        exilonAdmin,
                        DEADLINE,
                        { value: sellAmount.add(ONE) }
                    ),
                    "Pancake: TRANSFER_FAILED"
                );
                await PancakeRouterInst.swapExactETHForTokens(
                    ZERO,
                    [WETHInst.address, ExilonInst.address],
                    exilonAdmin,
                    DEADLINE,
                    { value: sellAmount }
                );

                blockNow = blockNow.add(STEP_DELTA_BLOCK[i]);
            }

            await time.advanceBlockTo(blockNow);

            await PancakeRouterInst.swapExactETHForTokens(
                ZERO,
                [WETHInst.address, ExilonInst.address],
                exilonAdmin,
                DEADLINE,
                { value: ONE_ETH.mul(TEN) }
            );
        });

        describe("Without fees", () => {
            it("Not fixed account", async () => {
                await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: ONE_ETH.mul(TEN).mul(TEN),
                });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin });

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [ZERO, ZERO, ZERO, ZERO]);

                await checkSell(
                    distributionAddress1,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [ZERO, ZERO, ZERO, ZERO]
                );
            });

            it("Fixed account", async () => {
                await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: ONE_ETH.mul(TEN).mul(TEN),
                });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress5, { from: exilonAdmin });

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [ZERO, ZERO, ZERO, ZERO]);

                await checkSell(
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress5),
                    [ZERO, ZERO, ZERO, ZERO]
                );
            });
        });

        describe("With fees", () => {
            it("Not fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                let blocknumber = new BN(tx.receipt.blockNumber);
                let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(NINE).div(TEN).sub(ONE),
                    [new BN("14"), ONE, ONE, TWO]
                );

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(NINE).div(TEN).add(ONE),
                    [new BN("16"), ONE, ONE, TWO]
                );

                await time.increaseTo(timestamp.add(time.duration.minutes(30)));

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(NINE).div(TEN).sub(ONE),
                    [new BN("11"), ONE, ONE, TWO]
                );

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(NINE).div(TEN).add(ONE),
                    [new BN("13"), ONE, ONE, TWO]
                );

                await time.increaseTo(timestamp.add(time.duration.minutes(60)));

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(NINE).div(TEN).sub(ONE),
                    [new BN("8"), ONE, ONE, TWO]
                );

                await checkBuy(distributionAddress1, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(NINE).div(TEN).add(ONE),
                    [new BN("10"), ONE, ONE, TWO]
                );
            });

            it("Fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                let blocknumber = new BN(tx.receipt.blockNumber);
                let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(NINE).div(TEN).sub(ONE),
                    [new BN("14"), ONE, ONE, TWO]
                );

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(NINE).div(TEN).add(ONE),
                    [new BN("16"), ONE, ONE, TWO]
                );

                await time.increaseTo(timestamp.add(time.duration.minutes(30)));

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(NINE).div(TEN).sub(ONE),
                    [new BN("11"), ONE, ONE, TWO]
                );

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(NINE).div(TEN).add(ONE),
                    [new BN("13"), ONE, ONE, TWO]
                );

                await time.increaseTo(timestamp.add(time.duration.minutes(60)));

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(NINE).div(TEN).sub(ONE),
                    [new BN("8"), ONE, ONE, TWO]
                );

                await checkBuy(distributionAddress5, ONE_ETH.div(TEN), [EIGHT, ONE, ONE, TWO]);
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(NINE).div(TEN).add(ONE),
                    [new BN("10"), ONE, ONE, TWO]
                );
            });
        });
    });

    describe("Adding and removing liquidity", () => {
        describe("No fees", () => {
            it("Not fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: liquidityAmount,
                });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                const accountFrom = defaultLpMintAddress;
                await ExilonInst.excludeFromPayingFees(accountFrom, { from: exilonAdmin });

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [ZERO, ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    ZERO,
                    ZERO,
                    ZERO,
                    ZERO,
                ]);

                await time.advanceBlockTo(blocknumber.add(new BN("240")));

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [ZERO, ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    ZERO,
                    ZERO,
                    ZERO,
                    ZERO,
                ]);
            });

            it("Fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: liquidityAmount,
                });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                const accountFrom = defaultLpMintAddress;
                await makeFixedAddress(accountFrom);
                await ExilonInst.excludeFromPayingFees(accountFrom, { from: exilonAdmin });

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [ZERO, ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    ZERO,
                    ZERO,
                    ZERO,
                    ZERO,
                ]);

                await time.advanceBlockTo(blocknumber.add(new BN("240")));

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [ZERO, ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    ZERO,
                    ZERO,
                    ZERO,
                    ZERO,
                ]);
            });
        });

        describe("With fees", () => {
            it("Not fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: liquidityAmount,
                });
                let blocknumber = new BN(tx.receipt.blockNumber);
                let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                const accountFrom = defaultLpMintAddress;
                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [EIGHT, ONE, ONE, TWO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    new BN("16"),
                    ONE,
                    ONE,
                    TWO,
                ]);

                await time.increaseTo(timestamp.add(time.duration.minutes(60)));

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [EIGHT, ONE, ONE, TWO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    new BN("10"),
                    ONE,
                    ONE,
                    TWO,
                ]);
            });

            it("Fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: liquidityAmount,
                });
                let blocknumber = new BN(tx.receipt.blockNumber);
                let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                const accountFrom = defaultLpMintAddress;
                await makeFixedAddress(accountFrom);

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [EIGHT, ONE, ONE, TWO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    new BN("16"),
                    ONE,
                    ONE,
                    TWO,
                ]);

                await time.increaseTo(timestamp.add(time.duration.minutes(60)));

                await checkRemoveLiquidity(
                    accountFrom,
                    await ExilonDexPairInst.balanceOf(accountFrom),
                    [EIGHT, ONE, ONE, TWO]
                );

                await checkAddLiquidity(accountFrom, await ExilonInst.balanceOf(accountFrom), [
                    new BN("10"),
                    ONE,
                    ONE,
                    TWO,
                ]);
            });
        });
    });

    describe("Distribute fees to lp", () => {
        it("Not adding when removing lp and buying", async () => {
            let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
            let blocknumber = new BN(tx.receipt.blockNumber);
            await makeFixedAddress(distributionAddress5);
            await makeFixedAddress(distributionAddress6);
            await makeFixedAddress(distributionAddress7);
            await makeFixedAddress(distributionAddress8);

            const accountFrom = defaultLpMintAddress;

            // removing lp
            let feeAmountBefore = await ExilonInst.feeAmountInTokens();
            await ExilonInst.setWethLimitForLpFee(ZERO, { from: exilonAdmin });

            let lpBalance = await ExilonDexPairInst.balanceOf(accountFrom);
            await ExilonDexPairInst.transfer(ExilonDexPairInst.address, lpBalance.div(TWO), {
                from: accountFrom,
            });
            await ExilonDexPairInst.burn(accountFrom, { from: accountFrom });
            let feeAmountAfter = await ExilonInst.feeAmountInTokens();

            expect(feeAmountAfter).to.be.bignumber.above(feeAmountBefore);
            expect(feeAmountAfter).not.to.be.bignumber.equals(ZERO);

            await time.advanceBlockTo(blocknumber.add(new BN("240")));

            // selling
            feeAmountBefore = await ExilonInst.feeAmountInTokens();

            let path = [WETHInst.address, ExilonInst.address];
            await PancakeRouterInst.swapExactETHForTokensSupportingFeeOnTransferTokens(
                ZERO,
                path,
                accountFrom,
                DEADLINE,
                { from: accountFrom, value: ONE_ETH.mul(TEN) }
            );

            feeAmountAfter = await ExilonInst.feeAmountInTokens();

            expect(feeAmountAfter).to.be.bignumber.above(feeAmountBefore);
            expect(feeAmountAfter).not.to.be.bignumber.equals(ZERO);
        });

        describe("Adding lp", () => {
            it("Not fixed", async () => {
                let tx = await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: liquidityAmount,
                });
                let blocknumber = new BN(tx.receipt.blockNumber);
                let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await time.advanceBlockTo(blocknumber.add(new BN("240")));
                await time.increaseTo(timestamp.add(time.duration.minutes(60)));

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    true
                );

                let amountEth = ONE_ETH.mul(TEN).mul(TEN);
                await WETHInst.deposit({ value: amountEth });
                await WETHInst.transfer(ExilonInst.address, amountEth);

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    true
                );
            });

            it("Fixed", async () => {
                let tx = await ExilonInst.addLiquidity({
                    from: exilonAdmin,
                    value: liquidityAmount,
                });
                let blocknumber = new BN(tx.receipt.blockNumber);
                let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await time.advanceBlockTo(blocknumber.add(new BN("240")));
                await time.increaseTo(timestamp.add(time.duration.minutes(60)));

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    true
                );

                let amountEth = ONE_ETH.mul(TEN).mul(TEN);
                await WETHInst.deposit({ value: amountEth });
                await WETHInst.transfer(ExilonInst.address, amountEth);

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, ONE, ONE, TWO],
                    true
                );
            });
        });
    });

    describe("Burn", () => {
        it("Stop at 60% from 59%", async () => {
            let tx = await ExilonInst.addLiquidity({
                from: exilonAdmin,
                value: liquidityAmount,
            });
            let blocknumber = new BN(tx.receipt.blockNumber);
            let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
            await makeFixedAddress(distributionAddress5);
            await makeFixedAddress(distributionAddress6);
            await makeFixedAddress(distributionAddress7);
            await makeFixedAddress(distributionAddress8);

            await ExilonInst.setWethLimitForLpFeeTest(liquidityAmount, { from: exilonAdmin });

            let from = distributionAddress1;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress2;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress3;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress4;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress5;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress6;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress7;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress8;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });

            await checkRemoveLiquidity(
                defaultLpMintAddress,
                (await ExilonDexPairInst.balanceOf(defaultLpMintAddress)).mul(NINE).div(TEN),
                [EIGHT, ONE, ONE, TWO]
            );

            let totalSupply = await ExilonInst.totalSupply();
            let maxBurnAmount = totalSupply.mul(SIX).div(TEN);
            let burnAmount = await ExilonInst.balanceOf(BURN_ADDRESS);

            expect(await ExilonInst.balanceOf(defaultLpMintAddress)).to.be.bignumber.above(
                maxBurnAmount.sub(burnAmount)
            );
            await ExilonInst.excludeFromPayingFees(defaultLpMintAddress, { from: exilonAdmin });
            await ExilonInst.transfer(BURN_ADDRESS, maxBurnAmount.sub(burnAmount).sub(TEN), {
                from: defaultLpMintAddress,
            });
            await ExilonInst.includeToPayingFees(defaultLpMintAddress, { from: exilonAdmin });

            await time.advanceBlockTo(blocknumber.add(new BN("240")));
            await time.increaseTo(timestamp.add(time.duration.minutes(60)));

            await checkBuy(defaultLpMintAddress, ONE_ETH.mul(TEN).mul(TEN).mul(TEN), [
                EIGHT,
                ONE,
                ONE,
                TWO,
            ]);
        });

        it("Stop at 60% from 60%", async () => {
            let tx = await ExilonInst.addLiquidity({
                from: exilonAdmin,
                value: liquidityAmount,
            });
            let blocknumber = new BN(tx.receipt.blockNumber);
            let timestamp = new BN((await web3.eth.getBlock(blocknumber)).timestamp);
            await makeFixedAddress(distributionAddress5);
            await makeFixedAddress(distributionAddress6);
            await makeFixedAddress(distributionAddress7);
            await makeFixedAddress(distributionAddress8);

            await ExilonInst.setWethLimitForLpFeeTest(liquidityAmount, { from: exilonAdmin });

            let from = distributionAddress1;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress2;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress3;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress4;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress5;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress6;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress7;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });
            from = distributionAddress8;
            await ExilonInst.transfer(defaultLpMintAddress, await ExilonInst.balanceOf(from), {
                from: from,
            });

            await checkRemoveLiquidity(
                defaultLpMintAddress,
                (await ExilonDexPairInst.balanceOf(defaultLpMintAddress)).mul(NINE).div(TEN),
                [EIGHT, ONE, ONE, TWO]
            );

            let totalSupply = await ExilonInst.totalSupply();
            let maxBurnAmount = totalSupply.mul(SIX).div(TEN);
            let burnAmount = await ExilonInst.balanceOf(BURN_ADDRESS);

            expect(await ExilonInst.balanceOf(defaultLpMintAddress)).to.be.bignumber.above(
                maxBurnAmount.sub(burnAmount)
            );
            await ExilonInst.excludeFromPayingFees(defaultLpMintAddress, { from: exilonAdmin });
            await ExilonInst.transfer(BURN_ADDRESS, maxBurnAmount.sub(burnAmount), {
                from: defaultLpMintAddress,
            });
            await ExilonInst.includeToPayingFees(defaultLpMintAddress, { from: exilonAdmin });

            await time.advanceBlockTo(blocknumber.add(new BN("240")));
            await time.increaseTo(timestamp.add(time.duration.minutes(60)));

            await checkBuy(defaultLpMintAddress, ONE_ETH.mul(TEN).mul(TEN).mul(TEN), [
                EIGHT,
                ONE,
                ONE,
                TWO,
            ]);
        });
    });

    it("forceLpFeesDistribute()", async () => {
        let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH.mul(TEN) });
        let blocknumber = new BN(tx.receipt.blockNumber);

        await expectRevert.unspecified(
            ExilonInst.forceLpFeesDistribute({ from: distributionAddress1 })
        );

        await time.advanceBlockTo(blocknumber.add(new BN("240")));

        let lpTotalSupplyBefore = await ExilonDexPairInst.totalSupply();
        await PancakeRouterInst.swapExactETHForTokens(
            ZERO,
            [WETHInst.address, ExilonInst.address],
            exilonAdmin,
            DEADLINE,
            { value: ONE_ETH.mul(TEN) }
        );
        let lpTotalSupplyAfter = await ExilonDexPairInst.totalSupply();
        expect(lpTotalSupplyAfter.sub(lpTotalSupplyBefore)).to.be.bignumber.equals(ZERO);

        await ExilonInst.forceLpFeesDistribute({ from: exilonAdmin });

        lpTotalSupplyAfter = await ExilonDexPairInst.totalSupply();
        expect(lpTotalSupplyAfter.sub(lpTotalSupplyBefore)).not.to.be.bignumber.equals(ZERO);
    });

    it("setWethReceiver()", async () => {
        await expectRevert.unspecified(
            ExilonInst.setWethReceiver(BURN_ADDRESS, { from: distributionAddress1 })
        );

        await expectRevert(
            ExilonInst.setWethReceiver(BURN_ADDRESS, { from: exilonAdmin }),
            "Exilon: Only once"
        );
    });

    it("setDefaultLpMintAddress()", async () => {
        await expectRevert.unspecified(
            ExilonInst.setDefaultLpMintAddress(BURN_ADDRESS, { from: distributionAddress1 })
        );

        await ExilonInst.setDefaultLpMintAddress(BURN_ADDRESS, { from: exilonAdmin });
        expect(await ExilonInst.defaultLpMintAddress()).to.be.equals(BURN_ADDRESS);
    });

    it("setWethLimitForLpFee()", async () => {
        await expectRevert.unspecified(
            ExilonInst.setWethLimitForLpFee(ZERO, { from: distributionAddress1 })
        );

        await ExilonInst.setWethLimitForLpFee(ONE, { from: exilonAdmin });
        expect(await ExilonInst.wethLimitForLpFee()).to.be.bignumber.equals(ONE);
    });

    it("exludeFromFeesDistribution() and includeToFeesDistribution()", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
        await makeFixedAddress(distributionAddress5);
        await makeFixedAddress(distributionAddress6);
        await makeFixedAddress(distributionAddress7);
        await makeFixedAddress(distributionAddress8);

        await expectRevert.unspecified(
            ExilonInst.excludeFromFeesDistribution(distributionAddress1, {
                from: distributionAddress1,
            })
        );

        // test exclude from fees distribution
        let balanceBefore = await ExilonInst.balanceOf(distributionAddress1);

        await ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.excludeFromFeesDistribution(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already excluded"
        );

        let balanceAfter = await ExilonInst.balanceOf(distributionAddress1);

        isNear(balanceAfter, balanceBefore);

        // test include in fees distribution
        balanceBefore = await ExilonInst.balanceOf(distributionAddress1);

        await ExilonInst.includeToFeesDistribution(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.includeToFeesDistribution(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already included"
        );
        await expectRevert(
            ExilonInst.includeToFeesDistribution(BURN_ADDRESS, { from: exilonAdmin }),
            "Exilon: Wrong address"
        );
        await expectRevert(
            ExilonInst.includeToFeesDistribution(ExilonDexPairInst.address, { from: exilonAdmin }),
            "Exilon: Wrong address"
        );
        await expectRevert(
            ExilonInst.includeToFeesDistribution(marketingAddress, { from: exilonAdmin }),
            "Exilon: Wrong address"
        );

        balanceAfter = await ExilonInst.balanceOf(distributionAddress1);

        isNear(balanceAfter, balanceBefore);
    });

    it("excludeFromPayingFees() and includeToPayingFees()", async () => {
        await expectRevert.unspecified(
            ExilonInst.excludeFromPayingFees(distributionAddress2, { from: distributionAddress1 })
        );

        await expectRevert(
            ExilonInst.includeToPayingFees(distributionAddress2, { from: exilonAdmin }),
            "Exilon: Already included"
        );

        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress1)).to.be.false;
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress2)).to.be.false;

        await ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already excluded"
        );

        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress1)).to.be.true;
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress2)).to.be.false;

        await ExilonInst.includeToPayingFees(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.includeToPayingFees(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already included"
        );

        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress1)).to.be.false;
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress2)).to.be.false;
    });

    it("marketing address check", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
        expect(await ExilonInst.marketingAddress()).to.be.equals(marketingAddress);
        expect(await ExilonInst.isExcludedFromDistribution(marketingAddress)).to.be.true;

        await expectRevert.unspecified(
            ExilonInst.setMarketingAddress(distributionAddress1, {
                from: distributionAddress1,
            })
        );
        await expectRevert(
            ExilonInst.setMarketingAddress(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Marketing address must be fixed"
        );

        await makeFixedAddress(distributionAddress1);

        await ExilonInst.setMarketingAddress(distributionAddress1, { from: exilonAdmin });
        expect(await ExilonInst.marketingAddress()).to.be.equals(distributionAddress1);
        expect(await ExilonInst.isExcludedFromDistribution(distributionAddress1)).to.be.true;
    });

    async function makeFixedAddress(user) {
        await ExilonInst.excludeFromFeesDistribution(user, { from: exilonAdmin });

        notFixedAddresses = removeFromArray(notFixedAddresses, user);
        fixedAddresses.push(user);
    }

    async function makeNotFixedAddress(user) {
        await ExilonInst.includeFromFeesDistribution(user, { from: exilonAdmin });

        fixedAddresses = removeFromArray(fixedAddresses, user);
        notFixedAddresses.push(user);
    }

    async function checkAddLiquidityWithLpDistribution(
        from,
        amount,
        feePercentages,
        isWithDistribution
    ) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceDexPairBefore = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceBefore = await ExilonInst.balanceOf(marketingAddress);

        let defaultLpMintAddress = await ExilonInst.defaultLpMintAddress();
        let defaultLpMintAddressLpBalanceBefore = await ExilonDexPairInst.balanceOf(
            defaultLpMintAddress
        );
        let lpTotalSupplyBefore = await ExilonDexPairInst.totalSupply();
        let fromLpBalanceBefore = await ExilonDexPairInst.balanceOf(from);

        let fixedAddressesBalancesBefore = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesBefore = [];
        let notFixedBalancesBefore = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesBefore = notFixedBalancesBefore.add(notFixedAddressesBalancesBefore[i]);
        }

        let lpAmount = amount.mul(feePercentages[0]).div(new BN("100"));
        let burnAmount = amount.mul(feePercentages[1]).div(new BN("100"));
        let distributionAmount = amount.mul(feePercentages[2]).div(new BN("100"));
        let marketingAmount = amount.mul(feePercentages[3]).div(new BN("100"));
        let transferAmount = amount
            .sub(lpAmount)
            .sub(burnAmount)
            .sub(distributionAmount)
            .sub(marketingAmount);

        let tokenReserves;
        let wethReserves;
        let reserves = await ExilonDexPairInst.getReserves();
        let token0 = await ExilonDexPairInst.token0();
        if (token0 == WETHInst.address) {
            wethReserves = reserves[0];
            tokenReserves = reserves[1];
        } else {
            tokenReserves = reserves[0];
            wethReserves = reserves[1];
        }
        let amountEth = await PancakeRouterInst.quote(amount, tokenReserves, wethReserves);

        let totalFeeTokenAmount = feeAmountBefore.add(lpAmount);
        let contractWethBalanceBefore = await WETHInst.balanceOf(ExilonInst.address);
        let dexPairWethBalanceBefore = await WETHInst.balanceOf(ExilonDexPairInst.address);
        let wethReceiverWethBalanceBefore = await WETHInst.balanceOf(WethReceiverInst.address);
        let wethPriceOfTokens = await PancakeRouterInst.getAmountOut(
            totalFeeTokenAmount,
            tokenReserves,
            wethReserves
        );
        let wethAmount = wethPriceOfTokens.add(contractWethBalanceBefore).div(TWO);
        let tokenAmountToAddInLiquidity = ZERO;
        let wethAmountToAddInLiquidity = ZERO;
        let tokenAmountToSell = ZERO;
        let wethAmountToBuy = ZERO;
        if (isWithDistribution) {
            await ExilonInst.setWethLimitForLpFeeTest(
                wethPriceOfTokens.add(contractWethBalanceBefore),
                { from: exilonAdmin }
            );
            if (wethAmount.gt(contractWethBalanceBefore)) {
                wethAmountToBuy = wethAmount.sub(contractWethBalanceBefore);

                tokenAmountToSell = (
                    await PancakeRouterInst.getAmountsIn(wethAmountToBuy, [
                        ExilonInst.address,
                        WETHInst.address,
                    ])
                )[0];

                totalFeeTokenAmount = totalFeeTokenAmount.sub(tokenAmountToSell);
            }

            wethAmountToAddInLiquidity = wethAmountToBuy.add(contractWethBalanceBefore);
            tokenAmountToAddInLiquidity = await PancakeRouterInst.quote(
                wethAmountToAddInLiquidity,
                wethReserves.sub(wethAmountToBuy),
                tokenReserves.add(tokenAmountToSell)
            );
            if (tokenAmountToAddInLiquidity.gt(totalFeeTokenAmount)) {
                tokenAmountToAddInLiquidity = totalFeeTokenAmount;
                wethAmountToAddInLiquidity = await PancakeRouterInst.quote(
                    totalFeeTokenAmount,
                    tokenReserves.add(tokenAmountToSell),
                    wethReserves.sub(wethAmountToBuy)
                );
            }
        } else {
            await ExilonInst.setWethLimitForLpFeeTest(
                wethPriceOfTokens.add(contractWethBalanceBefore).add(ONE),
                { from: exilonAdmin }
            );
        }

        await ExilonInst.approve(PancakeRouterInst.address, amount, { from: from });
        await WETHInst.deposit({ from: from, value: amountEth });
        await WETHInst.approve(PancakeRouterInst.address, amountEth, { from: from });
        let tx = await PancakeRouterInst.addLiquidity(
            WETHInst.address,
            ExilonInst.address,
            amountEth,
            amount,
            ZERO,
            ZERO,
            from,
            DEADLINE,
            { from: from }
        );
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            if (isWithDistribution) {
                console.log("Gas add liquidity with lp distribution =", gasAmount);
            } else {
                console.log("Gas add liquidity =", gasAmount);
            }
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceDexPairAfter = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountAfter = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceAfter = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceAfter = await ExilonInst.balanceOf(marketingAddress);

        let defaultLpMintAddressLpBalanceAfter = await ExilonDexPairInst.balanceOf(
            defaultLpMintAddress
        );
        let lpTotalSupplyAfter = await ExilonDexPairInst.totalSupply();
        let contractWethBalanceAfter = await WETHInst.balanceOf(ExilonInst.address);
        let dexPairWethBalanceAfter = await WETHInst.balanceOf(ExilonDexPairInst.address);
        let wethReceiverWethBalanceAfter = await WETHInst.balanceOf(WethReceiverInst.address);
        let fromLpBalanceAfter = await ExilonDexPairInst.balanceOf(from);

        expect(
            wethReceiverWethBalanceAfter.sub(wethReceiverWethBalanceBefore)
        ).to.be.bignumber.equals(ZERO);

        if (isWithDistribution) {
            isNear(
                feeAmountAfter,
                feeAmountBefore
                    .add(lpAmount)
                    .sub(tokenAmountToAddInLiquidity)
                    .sub(tokenAmountToSell)
            );
            expect(dexPairWethBalanceAfter.sub(dexPairWethBalanceBefore)).to.be.bignumber.equals(
                wethAmountToAddInLiquidity.add(amountEth).sub(wethAmountToBuy)
            );
            let realTransferAmount = balanceDexPairAfter.sub(balanceDexPairBefore);
            isNear(
                realTransferAmount,
                transferAmount.add(tokenAmountToSell).add(tokenAmountToAddInLiquidity)
            );
            expect(contractWethBalanceBefore.sub(contractWethBalanceAfter)).to.be.bignumber.equals(
                wethAmountToAddInLiquidity.sub(wethAmountToBuy)
            );

            expect(lpTotalSupplyAfter).to.be.bignumber.above(lpTotalSupplyBefore);
            let lpTotalSupplyDelta = lpTotalSupplyAfter.sub(lpTotalSupplyBefore);

            let tokenReservesAfterBuyWeth = tokenReserves.add(tokenAmountToSell);
            let wethReservesAfterBuyWeth = wethReserves.sub(wethAmountToBuy);

            let lpAmountDefaultLpMintAddress = BN.min(
                tokenAmountToAddInLiquidity.mul(lpTotalSupplyBefore).div(tokenReservesAfterBuyWeth),
                wethAmountToAddInLiquidity.mul(lpTotalSupplyBefore).div(wethReservesAfterBuyWeth)
            );

            let tokenReservesAfterLpDistribution = tokenReservesAfterBuyWeth.add(
                tokenAmountToAddInLiquidity
            );
            let wethReservesAfterLpDistribution = wethReservesAfterBuyWeth.add(
                wethAmountToAddInLiquidity
            );

            let lpAmountUser = BN.min(
                realTransferAmount
                    .sub(tokenAmountToSell)
                    .sub(tokenAmountToAddInLiquidity)
                    .mul(lpTotalSupplyBefore.add(lpAmountDefaultLpMintAddress))
                    .div(tokenReservesAfterLpDistribution),
                amountEth
                    .mul(lpTotalSupplyBefore.add(lpAmountDefaultLpMintAddress))
                    .div(wethReservesAfterLpDistribution)
            );

            expect(
                defaultLpMintAddressLpBalanceAfter.sub(defaultLpMintAddressLpBalanceBefore)
            ).to.be.bignumber.equals(lpAmountDefaultLpMintAddress);
            expect(fromLpBalanceAfter.sub(fromLpBalanceBefore)).to.be.bignumber.equals(
                lpAmountUser
            );

            expect(lpAmountDefaultLpMintAddress.add(lpAmountUser)).to.be.bignumber.equals(
                lpTotalSupplyDelta
            );
        } else {
            let realTransferAmount = balanceDexPairAfter.sub(balanceDexPairBefore);
            expect(dexPairWethBalanceAfter.sub(dexPairWethBalanceBefore)).to.be.bignumber.equals(
                amountEth
            );
            isNear(realTransferAmount, transferAmount);
            isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);

            expect(contractWethBalanceAfter).to.be.bignumber.equals(contractWethBalanceBefore);
            let lpAmountUser = BN.min(
                realTransferAmount.mul(lpTotalSupplyBefore).div(tokenReserves),
                amountEth.mul(lpTotalSupplyBefore).div(wethReserves)
            );

            let lpTotalSupplyDelta = lpTotalSupplyAfter.sub(lpTotalSupplyBefore);

            expect(fromLpBalanceAfter.sub(fromLpBalanceBefore)).to.be.bignumber.equals(
                lpTotalSupplyDelta
            );
            expect(lpTotalSupplyDelta).to.be.bignumber.equals(lpAmountUser);
        }

        let fixedAddressesBalancesAfter = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesAfter = [];
        let notFixedBalancesAfter = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesAfter = notFixedBalancesAfter.add(notFixedAddressesBalancesAfter[i]);
        }

        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);
        isNear(marketingBalanceAfter.sub(marketingBalanceBefore), marketingAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (
                fixedAddresses[i] != from &&
                fixedAddresses[i] != ExilonDexPairInst.address &&
                fixedAddresses[i] != BURN_ADDRESS &&
                fixedAddresses[i] != marketingAddress
            ) {
                expect(
                    fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])
                ).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(
                notFixedBalancesBefore.sub(notFixedBalancesAfter),
                amount.sub(distributionAmount)
            );
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i]
                .mul(distributionAmount)
                .div(notFixedBalancesAfter);
            if (notFixedAddresses[i] != from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet
                );
            } else if (notFixedAddresses[i] == from) {
                isNear(
                    notFixedAddressesBalancesBefore[i].sub(notFixedAddressesBalancesAfter[i]),
                    amount.sub(amountToGet)
                );
            }
        }
    }

    async function checkRemoveLiquidity(from, amount, feePercentages) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceDexPairBefore = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceBefore = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesBefore = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesBefore = [];
        let notFixedBalancesBefore = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesBefore = notFixedBalancesBefore.add(notFixedAddressesBalancesBefore[i]);
        }

        let tokenReserves;
        let wethReserves;
        let reserves = await ExilonDexPairInst.getReserves();
        let token0 = await ExilonDexPairInst.token0();
        if (token0 == WETHInst.address) {
            wethReserves = reserves[0];
            tokenReserves = reserves[1];
        } else {
            tokenReserves = reserves[0];
            wethReserves = reserves[1];
        }
        let totalSupplyLp = await ExilonDexPairInst.totalSupply();

        let tokenAmount = amount.mul(tokenReserves).div(totalSupplyLp);
        let ethAmount = amount.mul(wethReserves).div(totalSupplyLp);

        await ExilonDexPairInst.transfer(ExilonDexPairInst.address, amount, { from: from });
        let tx = await ExilonDexPairInst.burn(from, { from: from });
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            console.log("Gas removing liquidity =", gasAmount);
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceDexPairAfter = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountAfter = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceAfter = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceAfter = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesAfter = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesAfter = [];
        let notFixedBalancesAfter = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesAfter = notFixedBalancesAfter.add(notFixedAddressesBalancesAfter[i]);
        }

        let lpAmount = tokenAmount.mul(feePercentages[0]).div(new BN("100"));
        let burnAmount = tokenAmount.mul(feePercentages[1]).div(new BN("100"));
        let distributionAmount = tokenAmount.mul(feePercentages[2]).div(new BN("100"));
        let marketingAmount = tokenAmount.mul(feePercentages[3]).div(new BN("100"));
        let transferAmount = tokenAmount
            .sub(lpAmount)
            .sub(burnAmount)
            .sub(distributionAmount)
            .sub(marketingAmount);

        isNear(balanceDexPairBefore.sub(balanceDexPairAfter), tokenAmount);
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);
        isNear(marketingBalanceAfter.sub(marketingBalanceBefore), marketingAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (
                fixedAddresses[i] != from &&
                fixedAddresses[i] != ExilonDexPairInst.address &&
                fixedAddresses[i] != BURN_ADDRESS &&
                fixedAddresses[i] != marketingAddress
            ) {
                expect(
                    fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])
                ).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(
                notFixedBalancesAfter.sub(notFixedBalancesBefore),
                tokenAmount.sub(lpAmount).sub(burnAmount).sub(marketingAmount)
            );
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromAfter.sub(balanceFromBefore), transferAmount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i]
                .mul(distributionAmount)
                .div(notFixedBalancesAfter);
            if (notFixedAddresses[i] != from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet
                );
            } else if (notFixedAddresses[i] == from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet.add(transferAmount)
                );
            }
        }
    }

    async function checkAddLiquidity(from, amount, feePercentages) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceDexPairBefore = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceBefore = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesBefore = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesBefore = [];
        let notFixedBalancesBefore = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesBefore = notFixedBalancesBefore.add(notFixedAddressesBalancesBefore[i]);
        }

        let lpAmount = amount.mul(feePercentages[0]).div(new BN("100"));
        let burnAmount = amount.mul(feePercentages[1]).div(new BN("100"));
        let distributionAmount = amount.mul(feePercentages[2]).div(new BN("100"));
        let marketingAmount = amount.mul(feePercentages[3]).div(new BN("100"));
        let transferAmount = amount
            .sub(lpAmount)
            .sub(burnAmount)
            .sub(distributionAmount)
            .sub(marketingAmount);

        let tokenReserves;
        let wethReserves;
        let reserves = await ExilonDexPairInst.getReserves();
        let token0 = await ExilonDexPairInst.token0();
        if (token0 == WETHInst.address) {
            wethReserves = reserves[0];
            tokenReserves = reserves[1];
        } else {
            tokenReserves = reserves[0];
            wethReserves = reserves[1];
        }
        let amountEth = await PancakeRouterInst.quote(amount, tokenReserves, wethReserves);

        await ExilonInst.approve(PancakeRouterInst.address, amount, { from: from });
        let tx = await PancakeRouterInst.addLiquidityETH(
            ExilonInst.address,
            amount,
            ZERO,
            ZERO,
            from,
            DEADLINE,
            { from: from, value: amountEth }
        );
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            console.log("Gas add liquidity =", gasAmount);
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceDexPairAfter = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountAfter = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceAfter = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceAfter = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesAfter = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesAfter = [];
        let notFixedBalancesAfter = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesAfter = notFixedBalancesAfter.add(notFixedAddressesBalancesAfter[i]);
        }

        isNear(balanceDexPairAfter.sub(balanceDexPairBefore), transferAmount);
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);
        isNear(marketingBalanceAfter.sub(marketingBalanceBefore), marketingAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (
                fixedAddresses[i] != from &&
                fixedAddresses[i] != ExilonDexPairInst.address &&
                fixedAddresses[i] != BURN_ADDRESS &&
                fixedAddresses[i] != marketingAddress
            ) {
                expect(
                    fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])
                ).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(
                notFixedBalancesBefore.sub(notFixedBalancesAfter),
                amount.sub(distributionAmount)
            );
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i]
                .mul(distributionAmount)
                .div(notFixedBalancesAfter);
            if (notFixedAddresses[i] != from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet
                );
            } else if (notFixedAddresses[i] == from) {
                isNear(
                    notFixedAddressesBalancesBefore[i].sub(notFixedAddressesBalancesAfter[i]),
                    amount.sub(amountToGet)
                );
            }
        }
    }

    async function checkSell(from, amount, feePercentages) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceDexPairBefore = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceBefore = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesBefore = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesBefore = [];
        let notFixedBalancesBefore = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesBefore = notFixedBalancesBefore.add(notFixedAddressesBalancesBefore[i]);
        }

        let path = [ExilonInst.address, WETHInst.address];
        let amountsOut = await PancakeRouterInst.getAmountsOut(amount, path);
        await ExilonInst.approve(PancakeRouterInst.address, amount, { from: from });
        let tx = await PancakeRouterInst.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount,
            ZERO,
            path,
            from,
            DEADLINE,
            { from: from }
        );
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            console.log("Gas for sell =", gasAmount);
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceDexPairAfter = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountAfter = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceAfter = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceAfter = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesAfter = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesAfter = [];
        let notFixedBalancesAfter = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesAfter = notFixedBalancesAfter.add(notFixedAddressesBalancesAfter[i]);
        }

        let lpAmount = amount.mul(feePercentages[0]).div(new BN("100"));
        let burnAmount = amount.mul(feePercentages[1]).div(new BN("100"));
        let distributionAmount = amount.mul(feePercentages[2]).div(new BN("100"));
        let marketingAmount = amount.mul(feePercentages[3]).div(new BN("100"));
        let transferAmount = amount
            .sub(lpAmount)
            .sub(burnAmount)
            .sub(distributionAmount)
            .sub(marketingAmount);

        isNear(balanceDexPairAfter.sub(balanceDexPairBefore), transferAmount);
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);
        isNear(marketingBalanceAfter.sub(marketingBalanceBefore), marketingAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (
                fixedAddresses[i] != from &&
                fixedAddresses[i] != ExilonDexPairInst.address &&
                fixedAddresses[i] != BURN_ADDRESS &&
                fixedAddresses[i] != marketingAddress
            ) {
                expect(
                    fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])
                ).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(
                notFixedBalancesBefore.sub(notFixedBalancesAfter),
                amount.sub(distributionAmount)
            );
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i]
                .mul(distributionAmount)
                .div(notFixedBalancesAfter);
            if (notFixedAddresses[i] != from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet
                );
            } else if (notFixedAddresses[i] == from) {
                isNear(
                    notFixedAddressesBalancesBefore[i].sub(notFixedAddressesBalancesAfter[i]),
                    amount.sub(amountToGet)
                );
            }
        }
    }

    async function checkBuy(from, amount, feePercentages) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceDexPairBefore = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceBefore = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesBefore = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesBefore = [];
        let notFixedBalancesBefore = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesBefore = notFixedBalancesBefore.add(notFixedAddressesBalancesBefore[i]);
        }

        let path = [WETHInst.address, ExilonInst.address];
        let amountsOut = await PancakeRouterInst.getAmountsOut(amount, path);
        let tx = await PancakeRouterInst.swapExactETHForTokensSupportingFeeOnTransferTokens(
            ZERO,
            path,
            from,
            DEADLINE,
            { from: from, value: amount }
        );
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            console.log("Gas for buy =", gasAmount);
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceDexPairAfter = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountAfter = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceAfter = await ExilonInst.balanceOf(BURN_ADDRESS);
        let marketingBalanceAfter = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesAfter = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesAfter = [];
        let notFixedBalancesAfter = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesAfter = notFixedBalancesAfter.add(notFixedAddressesBalancesAfter[i]);
        }

        let lpAmount = amountsOut[1].mul(feePercentages[0]).div(new BN("100"));
        let burnAmount = amountsOut[1].mul(feePercentages[1]).div(new BN("100"));
        let distributionAmount = amountsOut[1].mul(feePercentages[2]).div(new BN("100"));
        let marketingAmount = amountsOut[1].mul(feePercentages[3]).div(new BN("100"));
        let transferAmount = amountsOut[1]
            .sub(lpAmount)
            .sub(burnAmount)
            .sub(distributionAmount)
            .sub(marketingAmount);

        isNear(balanceDexPairBefore.sub(balanceDexPairAfter), amountsOut[1]);

        let maxBurnAmount = TOTAL_SUPPLY.mul(SIX).div(TEN);
        if (burnAddressBalanceBefore.add(burnAmount).gt(maxBurnAmount)) {
            isNear(burnAddressBalanceAfter, maxBurnAmount);
            let additionalToLp = burnAddressBalanceBefore.add(burnAmount).sub(maxBurnAmount);
            isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount.add(additionalToLp));
            lpAmount = lpAmount.add(additionalToLp);
            burnAmount = burnAmount.sub(additionalToLp);
        } else {
            isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);
            isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        }
        isNear(marketingBalanceAfter.sub(marketingBalanceBefore), marketingAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (
                fixedAddresses[i] != from &&
                fixedAddresses[i] != ExilonDexPairInst.address &&
                fixedAddresses[i] != BURN_ADDRESS &&
                fixedAddresses[i] != marketingAddress
            ) {
                expect(
                    fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])
                ).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(
                notFixedBalancesAfter.sub(notFixedBalancesBefore),
                amountsOut[1].sub(lpAmount).sub(burnAmount).sub(marketingAmount)
            );
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromAfter.sub(balanceFromBefore), transferAmount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i]
                .mul(distributionAmount)
                .div(notFixedBalancesAfter);
            if (notFixedAddresses[i] != from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet
                );
            } else if (notFixedAddresses[i] == from) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet.add(transferAmount)
                );
            }
        }
    }

    async function checkTransfer(from, to, amount, withFee) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceToBefore = await ExilonInst.balanceOf(to);
        let balanceMarketingBefore = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesBefore = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesBefore = [];
        let notFixedBalancesBefore = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesBefore[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesBefore = notFixedBalancesBefore.add(notFixedAddressesBalancesBefore[i]);
        }

        let feeAmountInUsd = TEN.pow(await UsdTokenInst.decimals());
        let feeAmountInExilon;
        if (withFee) {
            feeAmountInExilon = (
                await PancakeRouterInst.getAmountsIn(feeAmountInUsd, [
                    ExilonInst.address,
                    WETHInst.address,
                    UsdTokenInst.address,
                ])
            )[0];
        } else {
            feeAmountInExilon = ZERO;
        }

        let tx = await ExilonInst.transfer(to, amount, { from: from });
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            console.log("Gas for transfer =", gasAmount);
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceToAfter = await ExilonInst.balanceOf(to);
        let balanceMarketingAfter = await ExilonInst.balanceOf(marketingAddress);

        let fixedAddressesBalancesAfter = [];
        for (let i = 0; i < fixedAddresses.length; ++i) {
            fixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(fixedAddresses[i]);
        }

        let notFixedAddressesBalancesAfter = [];
        let notFixedBalancesAfter = ZERO;
        for (let i = 0; i < notFixedAddresses.length; ++i) {
            notFixedAddressesBalancesAfter[i] = await ExilonInst.balanceOf(notFixedAddresses[i]);
            notFixedBalancesAfter = notFixedBalancesAfter.add(notFixedAddressesBalancesAfter[i]);
        }

        expect(balanceMarketingAfter.sub(balanceMarketingBefore)).to.be.bignumber.equals(
            feeAmountInExilon
        );

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (
                fixedAddresses[i] != from &&
                fixedAddresses[i] != to &&
                fixedAddresses[i] != marketingAddress
            ) {
                expect(
                    fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])
                ).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        let isToNotFixed = notFixedAddresses.indexOf(to) != -1;
        if (isFromNotFixed && isToNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), feeAmountInExilon);
        } else if (isFromNotFixed && !isToNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), amount);
        } else if (!isFromNotFixed && isToNotFixed) {
            isNear(
                notFixedBalancesAfter.sub(notFixedBalancesBefore),
                amount.sub(feeAmountInExilon)
            );
        } else if (!isFromNotFixed && !isToNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), ZERO);
        }

        isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        isNear(balanceToAfter.sub(balanceToBefore), amount.sub(feeAmountInExilon));
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
});

function restrictionsOnStart(blockDelta) {
    let blockNow = ZERO;
    for (let i = 0; i < STEP_DELTA_BLOCK.length; ++i) {
        if (blockDelta.gte(blockNow) && blockDelta.lt(blockNow.add(STEP_DELTA_BLOCK[i]))) {
            return FIRST_AMOUNT.add(STEP_AMOUNT.mul(new BN(i)));
        }
        blockNow = blockNow.add(STEP_DELTA_BLOCK[i]);
    }
    return;
}

function isNear(x, y) {
    expect(x.sub(y).abs()).to.be.bignumber.below(TEN);
}

function getRandomBN() {
    const random = randomBytes(32);
    return new BN(random.toString("hex"));
}

function getRandomBNFromTo(from, to) {
    const randomBN = getRandomBN();
    const delta = to.sub(from);
    return randomBN.mod(delta).add(from);
}

function removeFromArray(arr, value) {
    let index = arr.indexOf(value);
    expect(index).not.to.be.equals(-1);
    arr.splice(index, 1);
    return arr;
}
