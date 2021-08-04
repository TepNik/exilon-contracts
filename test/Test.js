const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const {
    BN,
    constants,
    expectEvent,
    expectRevert,
    time,
    balance,
    send
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { randomBytes } = require('crypto');

require('dotenv').config();
const {
} = process.env;

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

const DECIMALS = EIGHT;
const ONE_TOKEN = TEN.pow(DECIMALS);
const ONE_ETH = TEN.pow(EIGHTEEN);

const DEADLINE = new BN("10000000000000000000");
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const NAME = "Exilon";
const SYMBOL = "XLNT";
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
const WethReceiver = contract.fromArtifact('wethReceiver');

let PancakeFactoryInst;
let PancakeRouterInst;
let WETHInst;
let ExilonInst;
let ExilonDexPairInst;
let WethReceiverInst;

let fixedAddresses = [];
let notFixedAddresses = [];

describe('Exilon contract tests', () => {
    const [
        feeToSetter,
        exilonAdmin,
        defaultLpMintAddress,
        distributionAddress1,
        distributionAddress2,
        distributionAddress3,
        distributionAddress4,
        distributionAddress5,
        distributionAddress6,
        distributionAddress7,
        distributionAddress8
    ] = accounts;

    let defaultAdminRole;
    let liquidityAmount = ONE_ETH.mul(new BN("8000000000000"));

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
                distributionAddress4,
                distributionAddress5,
                distributionAddress6,
                distributionAddress7,
                distributionAddress8,
            ],
            defaultLpMintAddress,
            { from: exilonAdmin }
        );

        WethReceiverInst = await WethReceiver.new(
            ExilonInst.address
        );
        await ExilonInst.setWethReceiver(WethReceiverInst.address, { from: exilonAdmin });

        ExilonDexPairInst = await PancakePair.at(
            await PancakeFactoryInst.getPair(WETHInst.address, ExilonInst.address)
        );

        fixedAddresses = [];
        fixedAddresses.push(ExilonDexPairInst.address);
        fixedAddresses.push(BURN_ADDRESS);

        notFixedAddresses = [];
        notFixedAddresses.push(exilonAdmin);
        notFixedAddresses.push(distributionAddress1);
        notFixedAddresses.push(distributionAddress2);
        notFixedAddresses.push(distributionAddress3);
        notFixedAddresses.push(distributionAddress4);
        notFixedAddresses.push(distributionAddress5);
        notFixedAddresses.push(distributionAddress6);
        notFixedAddresses.push(distributionAddress7);
        notFixedAddresses.push(distributionAddress8);

        defaultAdminRole = await ExilonInst.DEFAULT_ADMIN_ROLE();
    })

    it("Deploy test", async () => {
        expect(await ExilonInst.dexRouter()).to.be.equals(PancakeRouterInst.address);
        expect(await ExilonInst.dexPair()).to.be.equals(ExilonDexPairInst.address);

        expect(await ExilonInst.wethReceiver()).to.be.equals(WethReceiverInst.address);
        expect(await ExilonInst.defaultLpMintAddress()).to.be.equals(defaultLpMintAddress);

        expect(await ExilonInst.name()).to.be.equals(NAME);
        expect(await ExilonInst.symbol()).to.be.equals(SYMBOL);
        expect(await ExilonInst.decimals()).to.be.bignumber.equals(DECIMALS);

        expect(await ExilonInst.totalSupply()).to.be.bignumber.equals(TOTAL_SUPPLY);

        expect(await ExilonInst.wethLimitForLpFee()).to.be.bignumber.equals(TWO.mul(ONE_ETH));

        expect(await ExilonInst.hasRole(defaultAdminRole, exilonAdmin)).to.be.true;

        let amountToLiqidity = TOTAL_SUPPLY.mul(EIGHT).div(TEN);
        expect(await ExilonInst.balanceOf(ExilonInst.address)).to.be.bignumber.equals(amountToLiqidity);

        expect(await ExilonInst.balanceOf(exilonAdmin)).to.be.bignumber.equals(ZERO);

        let amountToDistribution = TOTAL_SUPPLY.sub(amountToLiqidity);
        expect(await ExilonInst.balanceOf(distributionAddress1)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress2)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress3)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress4)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress5)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress6)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress7)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
        expect(await ExilonInst.balanceOf(distributionAddress8)).to.be.bignumber.equals(amountToDistribution.div(EIGHT));
    })

    it("addLiquidity()", async () => {
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

        await expectRevert(
            ExilonInst.forceLpFeesDistribute({ from: exilonAdmin }),
            "Exilon: Liquidity not added"
        );

        await expectRevert(
            ExilonInst.addLiquidity({ from: distributionAddress1 }),
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

    describe("transfer()", () => {
        it("transferFrom()", async () => {
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
                    [ZERO, ZERO, ZERO]
                );

                // test trasnfer of part balance
                await checkTransfer(
                    distributionAddress2,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress2)).div(THREE),
                    [ZERO, ZERO, ZERO]
                );
            })

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
                    [ZERO, ZERO, ZERO]
                );

                // test transfer part of balance
                await checkTransfer(
                    distributionAddress6,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress6)).div(THREE),
                    [ZERO, ZERO, ZERO]
                );
            })

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
                    [ZERO, ZERO, ZERO]
                );

                // test trasnfer of full balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [ZERO, ZERO, ZERO]
                );

                // test transfer less than half balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [ZERO, ZERO, ZERO]
                );

                // test transfer of half balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [ZERO, ZERO, ZERO]
                );
            })
        })

        describe("With fees", () => {
            it("Between not fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
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
                    [EIGHT, THREE, ONE]
                );

                // test trasnfer of part balance
                await checkTransfer(
                    distributionAddress2,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress2)).div(THREE),
                    [EIGHT, THREE, ONE]
                );
            })

            it("Between fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
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
                    [EIGHT, THREE, ONE]
                );

                // test transfer part of balance
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress6,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, THREE, ONE]
                );
            })

            it("Between not fixed and fixed addresses", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
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
                    [EIGHT, THREE, ONE]
                );

                // test trasnfer of full balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [EIGHT, THREE, ONE]
                );

                // test transfer less than half balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, THREE, ONE]
                );

                // test transfer of half balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, THREE, ONE]
                );
            })
        })
    })

    describe("Dex buy and sell", () => {
        it("Check buy restrictions on start", async () => {
            let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
            let blocknumber = new BN(tx.receipt.blockNumber);
            let step = new BN("60");
            for (let i = 0; i < 10; ++i) {
                let index = new BN(i);
                let newBlocknumber = blocknumber.add(step.mul(index));
                await time.advanceBlockTo(newBlocknumber);

                await expectRevert(
                    PancakeRouterInst.swapExactETHForTokens(
                        ZERO,
                        [WETHInst.address, ExilonInst.address],
                        exilonAdmin,
                        DEADLINE,
                        { value: ONE_ETH.div(TEN).mul(index.add(ONE)).add(ONE) }
                    ),
                    "Pancake: TRANSFER_FAILED"
                );
                await PancakeRouterInst.swapExactETHForTokens(
                    ZERO,
                    [WETHInst.address, ExilonInst.address],
                    exilonAdmin,
                    DEADLINE,
                    { value: ONE_ETH.div(TEN).mul(index.add(ONE)) }
                );
            }

            await time.advanceBlockTo(blocknumber.add(step.mul(new BN(11))));

            await PancakeRouterInst.swapExactETHForTokens(
                ZERO,
                [WETHInst.address, ExilonInst.address],
                exilonAdmin,
                DEADLINE,
                { value: ONE_ETH.mul(TEN) }
            );
        })

        describe("Without fees", () => {
            it("Not fixed account", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH.mul(TEN).mul(TEN) });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin });

                await checkBuy(
                    distributionAddress1,
                    ONE_ETH.div(TEN),
                    [ZERO, ZERO, ZERO]
                );

                await checkSell(
                    distributionAddress1,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [ZERO, ZERO, ZERO]
                );
            })

            it("Fixed account", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH.mul(TEN).mul(TEN) });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(distributionAddress5, { from: exilonAdmin });

                await checkBuy(
                    distributionAddress5,
                    ONE_ETH.div(TEN),
                    [ZERO, ZERO, ZERO]
                );

                await checkSell(
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress5),
                    [ZERO, ZERO, ZERO]
                );
            })
        })

        describe("With fees", () => {
            it("Not fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await checkBuy(
                    distributionAddress1,
                    ONE_ETH.div(TEN),
                    [EIGHT, THREE, ONE]
                );

                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                    [new BN("23"), THREE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("200")));
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                    [new BN("22"), THREE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("350")));

                let startBlock = blocknumber.add(new BN("350"));
                let step = new BN("100");
                for (let i = 0; i < 13; ++i) {
                    let index = new BN(i);
                    await checkSell(
                        distributionAddress1,
                        (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                        [(new BN("21")).sub(index), THREE, ONE]
                    );

                    let newBlocknumber = startBlock.add(step.mul(index.add(ONE)));
                    await time.advanceBlockTo(newBlocknumber);
                }

                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TWO).sub(ONE),
                    [EIGHT, THREE, ONE]
                );
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TWO),
                    [new BN("13"), THREE, ONE]
                );
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(THREE).div(FOUR).sub(ONE),
                    [new BN("13"), THREE, ONE]
                );
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).mul(THREE).div(FOUR),
                    [new BN("18"), THREE, ONE]
                );
            })

            it("Fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await checkBuy(
                    distributionAddress5,
                    ONE_ETH.div(TEN),
                    [EIGHT, THREE, ONE]
                );

                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                    [new BN("23"), THREE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("200")));
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                    [new BN("22"), THREE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("350")));

                let startBlock = blocknumber.add(new BN("350"));
                let step = new BN("100");
                for (let i = 0; i < 13; ++i) {
                    let index = new BN(i);
                    await checkSell(
                        distributionAddress5,
                        (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                        [(new BN("21")).sub(index), THREE, ONE]
                    );

                    let newBlocknumber = startBlock.add(step.mul(index.add(ONE)));
                    await time.advanceBlockTo(newBlocknumber);
                }

                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TWO).sub(ONE),
                    [EIGHT, THREE, ONE]
                );
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TWO),
                    [new BN("13"), THREE, ONE]
                );
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(THREE).div(FOUR).sub(ONE),
                    [new BN("13"), THREE, ONE]
                );
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).mul(THREE).div(FOUR),
                    [new BN("18"), THREE, ONE]
                );
            })
        })

        describe("No restrictions on sell accounts", () => {
            it("Not fixed account", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.removeRestrictionsOnSell(distributionAddress1, { from: exilonAdmin });

                await checkBuy(
                    distributionAddress1,
                    ONE_ETH.div(TEN),
                    [EIGHT, THREE, ONE]
                );

                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                    [EIGHT, THREE, ONE]
                );

                await checkSell(
                    distributionAddress1,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [EIGHT, THREE, ONE]
                );
            })

            it("Fixed account", async () => {
                await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.removeRestrictionsOnSell(distributionAddress5, { from: exilonAdmin });

                await checkBuy(
                    distributionAddress5,
                    ONE_ETH.div(TEN),
                    [EIGHT, THREE, ONE]
                );

                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                    [EIGHT, THREE, ONE]
                );

                await checkSell(
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress5),
                    [EIGHT, THREE, ONE]
                );
            })
        })
    })

    describe("Adding and removing liquidity", () => {
        describe("No fees", () => {
            it("Not fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await ExilonInst.excludeFromPayingFees(exilonAdmin, { from: exilonAdmin });

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );

                await time.advanceBlockTo(blocknumber.add(new BN("300")));
                await time.advanceBlockTo(blocknumber.add(new BN("600")));
                await time.advanceBlockTo(blocknumber.add(new BN("900")));
                await time.advanceBlockTo(blocknumber.add(new BN("1200")));
                await time.advanceBlockTo(blocknumber.add(new BN("1500")));
                await time.advanceBlockTo(blocknumber.add(new BN("1650")));

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );
            })

            it("Fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await makeFixedAddress(exilonAdmin);
                await ExilonInst.excludeFromPayingFees(exilonAdmin, { from: exilonAdmin });

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );

                await time.advanceBlockTo(blocknumber.add(new BN("300")));
                await time.advanceBlockTo(blocknumber.add(new BN("600")));
                await time.advanceBlockTo(blocknumber.add(new BN("900")));
                await time.advanceBlockTo(blocknumber.add(new BN("1200")));
                await time.advanceBlockTo(blocknumber.add(new BN("1500")));
                await time.advanceBlockTo(blocknumber.add(new BN("1650")));

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [ZERO, ZERO, ZERO]
                );
            })
        })

        describe("With fees", () => {
            it("Not fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [EIGHT, THREE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("23"), THREE, ONE]
                );

                await time.advanceBlockTo(blocknumber.add(new BN("300")));
                await time.advanceBlockTo(blocknumber.add(new BN("600")));
                await time.advanceBlockTo(blocknumber.add(new BN("900")));
                await time.advanceBlockTo(blocknumber.add(new BN("1200")));
                await time.advanceBlockTo(blocknumber.add(new BN("1500")));
                await time.advanceBlockTo(blocknumber.add(new BN("1650")));

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [EIGHT, THREE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("18"), THREE, ONE]
                );
            })

            it("Fixed account", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await makeFixedAddress(exilonAdmin);

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [EIGHT, THREE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("23"), THREE, ONE]
                );

                await time.advanceBlockTo(blocknumber.add(new BN("300")));
                await time.advanceBlockTo(blocknumber.add(new BN("600")));
                await time.advanceBlockTo(blocknumber.add(new BN("900")));
                await time.advanceBlockTo(blocknumber.add(new BN("1200")));
                await time.advanceBlockTo(blocknumber.add(new BN("1500")));
                await time.advanceBlockTo(blocknumber.add(new BN("1650")));

                await checkRemoveLiquidity(
                    exilonAdmin,
                    await ExilonDexPairInst.balanceOf(exilonAdmin),
                    [EIGHT, THREE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("18"), THREE, ONE]
                );
            })
        })
    })

    describe("Distribute fees to lp", () => {
        it("Not adding when removing lp and buying", async () => {
            let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
            let blocknumber = new BN(tx.receipt.blockNumber);
            await makeFixedAddress(distributionAddress5);
            await makeFixedAddress(distributionAddress6);
            await makeFixedAddress(distributionAddress7);
            await makeFixedAddress(distributionAddress8);

            // removing lp
            let feeAmountBefore = await ExilonInst.feeAmountInTokens();
            await ExilonInst.setWethLimitForLpFee(ZERO, { from: exilonAdmin });

            let adminBalance = await ExilonDexPairInst.balanceOf(exilonAdmin);
            await ExilonDexPairInst.transfer(ExilonDexPairInst.address, adminBalance.div(TWO), { from: exilonAdmin });
            await ExilonDexPairInst.burn(exilonAdmin, { from: exilonAdmin });
            let feeAmountAfter = await ExilonInst.feeAmountInTokens();

            //console.log("Before =". feeAmountBefore.toString());
            //console.log("After =". feeAmountAfter.toString());
            expect(feeAmountAfter).to.be.bignumber.above(feeAmountBefore);
            expect(feeAmountAfter).not.to.be.bignumber.equals(ZERO);

            await time.advanceBlockTo(blocknumber.add(new BN("600")));

            // selling
            feeAmountBefore = await ExilonInst.feeAmountInTokens();

            let path = [WETHInst.address, ExilonInst.address];
            await PancakeRouterInst.swapExactETHForTokensSupportingFeeOnTransferTokens(
                ZERO,
                path,
                exilonAdmin,
                DEADLINE,
                { from: exilonAdmin, value: ONE_ETH.mul(TEN) }
            );

            feeAmountAfter = await ExilonInst.feeAmountInTokens();

            expect(feeAmountAfter).to.be.bignumber.above(feeAmountBefore);
            expect(feeAmountAfter).not.to.be.bignumber.equals(ZERO);
        })

        describe("Adding lp", () => {
            it("Not fixed", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await time.advanceBlockTo(blocknumber.add(new BN("1650")));

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, THREE, ONE],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, THREE, ONE],
                    true
                );

                let amountEth = ONE_ETH.mul(TEN).mul(TEN);
                await WETHInst.deposit({ value: amountEth });
                await WETHInst.transfer(ExilonInst.address, amountEth);

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, THREE, ONE],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, THREE, ONE],
                    true
                );
            })

            it("Fixed", async () => {
                let tx = await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
                let blocknumber = new BN(tx.receipt.blockNumber);
                await makeFixedAddress(distributionAddress5);
                await makeFixedAddress(distributionAddress6);
                await makeFixedAddress(distributionAddress7);
                await makeFixedAddress(distributionAddress8);

                await time.advanceBlockTo(blocknumber.add(new BN("1650")));

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, THREE, ONE],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, THREE, ONE],
                    true
                );

                let amountEth = ONE_ETH.mul(TEN).mul(TEN);
                await WETHInst.deposit({ value: amountEth });
                await WETHInst.transfer(ExilonInst.address, amountEth);

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, THREE, ONE],
                    false
                );

                await checkAddLiquidityWithLpDistribution(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, THREE, ONE],
                    true
                );
            })
        })
    })

    describe("Burn", () => {
        it("Stop at 60% from 59%", async () => {
            await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
            await makeFixedAddress(distributionAddress5);
            await makeFixedAddress(distributionAddress6);
            await makeFixedAddress(distributionAddress7);
            await makeFixedAddress(distributionAddress8);

            await ExilonInst.setWethLimitForLpFee(liquidityAmount, { from: exilonAdmin });
            await checkRemoveLiquidity(
                exilonAdmin,
                await ExilonDexPairInst.balanceOf(exilonAdmin),
                [EIGHT, THREE, ONE]
            );

            let from = distributionAddress1;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress2;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress3;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress4;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress5;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress6;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress7;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress8;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });

            let totalSupply = await ExilonInst.totalSupply();
            let maxBurnAmount = totalSupply.mul(SIX).div(TEN);
            let burnAmount = await ExilonInst.balanceOf(BURN_ADDRESS);

            expect(await ExilonInst.balanceOf(exilonAdmin)).to.be.bignumber.above(maxBurnAmount.sub(burnAmount));
            await ExilonInst.excludeFromPayingFees(exilonAdmin, { from: exilonAdmin });
            await ExilonInst.transfer(BURN_ADDRESS, maxBurnAmount.sub(burnAmount).sub(TEN.mul(TEN)), { from: exilonAdmin });
            await ExilonInst.includeToPayingFees(exilonAdmin, { from: exilonAdmin });

            await checkTransfer(
                exilonAdmin,
                distributionAddress1,
                await ExilonInst.balanceOf(exilonAdmin),
                [EIGHT, THREE, ONE]
            );
        })

        it("Stop at 60% from 60%", async () => {
            await ExilonInst.addLiquidity({ from: exilonAdmin, value: liquidityAmount });
            await makeFixedAddress(distributionAddress5);
            await makeFixedAddress(distributionAddress6);
            await makeFixedAddress(distributionAddress7);
            await makeFixedAddress(distributionAddress8);

            await ExilonInst.setWethLimitForLpFee(liquidityAmount, { from: exilonAdmin });
            await checkRemoveLiquidity(
                exilonAdmin,
                await ExilonDexPairInst.balanceOf(exilonAdmin),
                [EIGHT, THREE, ONE]
            );

            let from = distributionAddress1;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress2;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress3;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress4;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress5;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress6;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress7;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });
            from = distributionAddress8;
            await ExilonInst.transfer(exilonAdmin, await ExilonInst.balanceOf(from), { from: from });

            let totalSupply = await ExilonInst.totalSupply();
            let maxBurnAmount = totalSupply.mul(SIX).div(TEN);
            let burnAmount = await ExilonInst.balanceOf(BURN_ADDRESS);

            expect(await ExilonInst.balanceOf(exilonAdmin)).to.be.bignumber.above(maxBurnAmount.sub(burnAmount));
            await ExilonInst.excludeFromPayingFees(exilonAdmin, { from: exilonAdmin });
            await ExilonInst.transfer(BURN_ADDRESS, maxBurnAmount.sub(burnAmount), { from: exilonAdmin });
            await ExilonInst.includeToPayingFees(exilonAdmin, { from: exilonAdmin });

            await checkTransfer(
                exilonAdmin,
                distributionAddress1,
                await ExilonInst.balanceOf(exilonAdmin),
                [EIGHT, THREE, ONE]
            );
        })
    })

    it("setWethReceiver()", async () => {
        await expectRevert(
            ExilonInst.setWethReceiver(
                BURN_ADDRESS,
                { from: distributionAddress1 }
            ),
            "Exilon: Sender is not admin"
        );

        await expectRevert(
            ExilonInst.setWethReceiver(
                BURN_ADDRESS,
                { from: exilonAdmin }
            ),
            "Exilon: Only once"
        );
    })

    it("setDefaultLpMintAddress()", async () => {
        await expectRevert(
            ExilonInst.setDefaultLpMintAddress(
                BURN_ADDRESS,
                { from: distributionAddress1 }
            ),
            "Exilon: Sender is not admin"
        );

        await ExilonInst.setDefaultLpMintAddress(BURN_ADDRESS, { from: exilonAdmin });
        expect(await ExilonInst.defaultLpMintAddress()).to.be.equals(BURN_ADDRESS);
    })

    it("setWethLimitForLpFee()", async () => {
        await expectRevert(
            ExilonInst.setWethLimitForLpFee(
                ZERO,
                { from: distributionAddress1 }
            ),
            "Exilon: Sender is not admin"
        );

        await ExilonInst.setWethLimitForLpFee(ONE, { from: exilonAdmin });
        expect(await ExilonInst.wethLimitForLpFee()).to.be.bignumber.equals(ONE);
    })

    it("exludeFromFeesDistribution() and includeToFeesDistribution()", async () => {
        await ExilonInst.addLiquidity({ from: exilonAdmin, value: ONE_ETH });
        await makeFixedAddress(distributionAddress5);
        await makeFixedAddress(distributionAddress6);
        await makeFixedAddress(distributionAddress7);
        await makeFixedAddress(distributionAddress8);


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

        expect(balanceAfter).to.be.bignumber.equals(balanceBefore);
    })

    it("excludeFromPayingFees() and includeToPayingFees()", async () => {
        await expectRevert(
            ExilonInst.excludeFromPayingFees(distributionAddress2, { from: distributionAddress1 }),
            "Exilon: Sender is not admin"
        );

        await expectRevert(
            ExilonInst.includeToPayingFees(distributionAddress2, { from: exilonAdmin }),
            "Exilon: Already included"
        );

        expect(await ExilonInst.excludedFromPayingFeesLen()).to.be.bignumber.equals(ZERO);
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress1)).to.be.false;
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress2)).to.be.false;

        await ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.excludeFromPayingFees(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already excluded"
        );

        expect(await ExilonInst.excludedFromPayingFeesLen()).to.be.bignumber.equals(ONE);
        expect(await ExilonInst.getExcludedFromPayingFeesAt(ZERO)).to.be.bignumber.equals(distributionAddress1);
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress1)).to.be.true;
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress2)).to.be.false;

        await ExilonInst.includeToPayingFees(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.includeToPayingFees(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already included"
        );

        expect(await ExilonInst.excludedFromPayingFeesLen()).to.be.bignumber.equals(ZERO);
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress1)).to.be.false;
        expect(await ExilonInst.isExcludedFromPayingFees(distributionAddress2)).to.be.false;
    })

    it("removeRestrictionsOnSell() and imposeRestrictionsOnSell()", async () => {
        await expectRevert(
            ExilonInst.removeRestrictionsOnSell(distributionAddress2, { from: distributionAddress1 }),
            "Exilon: Sender is not admin"
        );

        await expectRevert(
            ExilonInst.imposeRestrictionsOnSell(distributionAddress2, { from: exilonAdmin }),
            "Exilon: Already imposed"
        );

        expect(await ExilonInst.noRestrictionsOnSellLen()).to.be.bignumber.equals(ZERO);
        expect(await ExilonInst.isNoRestrictionsOnSell(distributionAddress1)).to.be.false;
        expect(await ExilonInst.isNoRestrictionsOnSell(distributionAddress2)).to.be.false;

        await ExilonInst.removeRestrictionsOnSell(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.removeRestrictionsOnSell(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already removed"
        );

        expect(await ExilonInst.noRestrictionsOnSellLen()).to.be.bignumber.equals(ONE);
        expect(await ExilonInst.getNoRestrictionsOnSellAt(ZERO)).to.be.bignumber.equals(distributionAddress1);
        expect(await ExilonInst.isNoRestrictionsOnSell(distributionAddress1)).to.be.true;
        expect(await ExilonInst.isNoRestrictionsOnSell(distributionAddress2)).to.be.false;

        await ExilonInst.imposeRestrictionsOnSell(distributionAddress1, { from: exilonAdmin });
        await expectRevert(
            ExilonInst.imposeRestrictionsOnSell(distributionAddress1, { from: exilonAdmin }),
            "Exilon: Already imposed"
        );

        expect(await ExilonInst.noRestrictionsOnSellLen()).to.be.bignumber.equals(ZERO);
        expect(await ExilonInst.isNoRestrictionsOnSell(distributionAddress1)).to.be.false;
        expect(await ExilonInst.isNoRestrictionsOnSell(distributionAddress2)).to.be.false;
    })



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

    async function checkAddLiquidityWithLpDistribution(from, amount, feePercentages, isWithDistribution) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceDexPairBefore = await ExilonInst.balanceOf(ExilonDexPairInst.address);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);

        let defaultLpMintAddress = await ExilonInst.defaultLpMintAddress();
        let defaultLpMintAddressLpBalanceBefore = await ExilonDexPairInst.balanceOf(defaultLpMintAddress);
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
        let transferAmount = amount.sub(lpAmount).sub(burnAmount).sub(distributionAmount);

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
        let amountEth = await PancakeRouterInst.quote(
            amount,
            tokenReserves,
            wethReserves
        );

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
            await ExilonInst.setWethLimitForLpFee(wethPriceOfTokens.add(contractWethBalanceBefore), { from: exilonAdmin });
            if (wethAmount.gt(contractWethBalanceBefore)) {
                wethAmountToBuy = wethAmount.sub(contractWethBalanceBefore);

                tokenAmountToSell = (await PancakeRouterInst.getAmountsIn(
                    wethAmountToBuy,
                    [ExilonInst.address, WETHInst.address]
                ))[0];

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
            await ExilonInst.setWethLimitForLpFee(wethPriceOfTokens.add(contractWethBalanceBefore).add(ONE), { from: exilonAdmin });
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

        let defaultLpMintAddressLpBalanceAfter = await ExilonDexPairInst.balanceOf(defaultLpMintAddress);
        let lpTotalSupplyAfter = await ExilonDexPairInst.totalSupply();
        let contractWethBalanceAfter = await WETHInst.balanceOf(ExilonInst.address);
        let dexPairWethBalanceAfter = await WETHInst.balanceOf(ExilonDexPairInst.address);
        let wethReceiverWethBalanceAfter = await WETHInst.balanceOf(WethReceiverInst.address);
        let fromLpBalanceAfter = await ExilonDexPairInst.balanceOf(from);

        expect(wethReceiverWethBalanceAfter.sub(wethReceiverWethBalanceBefore)).to.be.bignumber.equals(ZERO);

        if (isWithDistribution) {
            isNear(feeAmountAfter, feeAmountBefore.add(lpAmount).sub(tokenAmountToAddInLiquidity).sub(tokenAmountToSell));
            expect(dexPairWethBalanceAfter.sub(dexPairWethBalanceBefore)).to.be.bignumber.equals(wethAmountToAddInLiquidity.add(amountEth).sub(wethAmountToBuy));
            isNear(balanceDexPairAfter.sub(balanceDexPairBefore), transferAmount.add(tokenAmountToSell).add(tokenAmountToAddInLiquidity));
            expect(contractWethBalanceBefore.sub(contractWethBalanceAfter)).to.be.bignumber.equals(wethAmountToAddInLiquidity.sub(wethAmountToBuy));

            expect(lpTotalSupplyAfter).to.be.bignumber.above(lpTotalSupplyBefore);
            let lpTotalSupplyDelta = lpTotalSupplyAfter.sub(lpTotalSupplyBefore);

            let tokenReservesAfterBuyWeth = tokenReserves.add(tokenAmountToSell);
            let wethReservesAfterBuyWeth = wethReserves.sub(wethAmountToBuy);

            let lpAmountDefaultLpMintAddress = BN.min(
                tokenAmountToAddInLiquidity.mul(lpTotalSupplyBefore).div(tokenReservesAfterBuyWeth),
                wethAmountToAddInLiquidity.mul(lpTotalSupplyBefore).div(wethReservesAfterBuyWeth)
            );

            let tokenReservesAfterLpDistribution = tokenReservesAfterBuyWeth.add(tokenAmountToAddInLiquidity);
            let wethReservesAfterLpDistribution = wethReservesAfterBuyWeth.add(wethAmountToAddInLiquidity);

            let lpAmountUser = BN.min(
                transferAmount.mul(lpTotalSupplyBefore.add(lpAmountDefaultLpMintAddress)).div(tokenReservesAfterLpDistribution),
                amountEth.mul(lpTotalSupplyBefore.add(lpAmountDefaultLpMintAddress)).div(wethReservesAfterLpDistribution)
            );

            console.log("wethAmountToBuy =", wethAmountToBuy.toString());
            console.log("amountEth =", amountEth.toString());
            console.log("transferAmount =", transferAmount.toString());
            console.log("wethAmountToAddInLiquidity =", wethAmountToAddInLiquidity.toString());
            console.log("lpAmountUser =", lpAmountUser.toString());
            console.log("lp user balance change =", fromLpBalanceAfter.sub(fromLpBalanceBefore).toString());

            expect(defaultLpMintAddressLpBalanceAfter.sub(defaultLpMintAddressLpBalanceBefore)).to.be.bignumber.equals(lpAmountDefaultLpMintAddress);
            expect(fromLpBalanceAfter.sub(fromLpBalanceBefore)).to.be.bignumber.equals(lpAmountUser);

            expect(lpAmountDefaultLpMintAddress.add(lpAmountUser)).to.be.bignumber.equals(lpTotalSupplyDelta);
        } else {
            isNear(balanceDexPairAfter.sub(balanceDexPairBefore), transferAmount);
            isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);

            expect(contractWethBalanceAfter).to.be.bignumber.equals(contractWethBalanceBefore);
            let lpAmountUser = BN.min(
                transferAmount.mul(lpTotalSupplyBefore).div(tokenReserves),
                amountEth.mul(lpTotalSupplyBefore).div(wethReserves)
            );

            expect(lpTotalSupplyAfter.sub(lpTotalSupplyBefore)).to.be.bignumber.equals(lpAmountUser);
            expect(fromLpBalanceAfter.sub(fromLpBalanceBefore)).to.be.bignumber.equals(lpAmountUser);
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

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (fixedAddresses[i] != from && fixedAddresses[i] != ExilonDexPairInst.address && fixedAddresses[i] != BURN_ADDRESS) {
                expect(fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), amount.sub(distributionAmount));
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i].mul(distributionAmount).div(notFixedBalancesAfter);
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
        let transferAmount = tokenAmount.sub(lpAmount).sub(burnAmount).sub(distributionAmount);

        isNear(balanceDexPairBefore.sub(balanceDexPairAfter), tokenAmount);
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (fixedAddresses[i] != from && fixedAddresses[i] != ExilonDexPairInst.address && fixedAddresses[i] != BURN_ADDRESS) {
                expect(fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), tokenAmount.sub(lpAmount).sub(burnAmount));
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromAfter.sub(balanceFromBefore), transferAmount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i].mul(distributionAmount).div(notFixedBalancesAfter);
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
        let transferAmount = amount.sub(lpAmount).sub(burnAmount).sub(distributionAmount);

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
        let amountEth = await PancakeRouterInst.quote(
            amount,
            tokenReserves,
            wethReserves
        );

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

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (fixedAddresses[i] != from && fixedAddresses[i] != ExilonDexPairInst.address && fixedAddresses[i] != BURN_ADDRESS) {
                expect(fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), amount.sub(distributionAmount));
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i].mul(distributionAmount).div(notFixedBalancesAfter);
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
        let transferAmount = amount.sub(lpAmount).sub(burnAmount).sub(distributionAmount);

        isNear(balanceDexPairAfter.sub(balanceDexPairBefore), transferAmount);
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (fixedAddresses[i] != from && fixedAddresses[i] != ExilonDexPairInst.address && fixedAddresses[i] != BURN_ADDRESS) {
                expect(fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), amount.sub(distributionAmount));
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i].mul(distributionAmount).div(notFixedBalancesAfter);
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
        let transferAmount = amountsOut[1].sub(lpAmount).sub(burnAmount).sub(distributionAmount);

        isNear(balanceDexPairBefore.sub(balanceDexPairAfter), amountsOut[1]);
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (fixedAddresses[i] != from && fixedAddresses[i] != ExilonDexPairInst.address && fixedAddresses[i] != BURN_ADDRESS) {
                expect(fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        if (isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), amountsOut[1].sub(lpAmount).sub(burnAmount));
        } else if (!isFromNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromAfter.sub(balanceFromBefore), transferAmount);
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i].mul(distributionAmount).div(notFixedBalancesAfter);
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

    async function checkTransfer(from, to, amount, feePercentages) {
        let balanceFromBefore = await ExilonInst.balanceOf(from);
        let balanceToBefore = await ExilonInst.balanceOf(to);
        let feeAmountBefore = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceBefore = await ExilonInst.balanceOf(BURN_ADDRESS);

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

        let tx = await ExilonInst.transfer(to, amount, { from: from });
        let gasAmount = tx.receipt.gasUsed;
        if (testsWithOutput) {
            console.log("Gas for transfer =", gasAmount);
        }

        let balanceFromAfter = await ExilonInst.balanceOf(from);
        let balanceToAfter = await ExilonInst.balanceOf(to);
        let feeAmountAfter = await ExilonInst.feeAmountInTokens();
        let burnAddressBalanceAfter = await ExilonInst.balanceOf(BURN_ADDRESS);

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

        let maxBurnAmount = TOTAL_SUPPLY.mul(SIX).div(TEN);
        if (burnAddressBalanceBefore.add(burnAmount).gt(maxBurnAmount)) {
            isNear(burnAddressBalanceAfter, maxBurnAmount);
            let additionalToLp = burnAddressBalanceBefore.add(burnAmount).sub(maxBurnAmount);
            isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount.add(additionalToLp));
        } else {
            isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);
            isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        }

        for (let i = 0; i < fixedAddresses.length; ++i) {
            if (fixedAddresses[i] != from && fixedAddresses[i] != to && fixedAddresses[i] != BURN_ADDRESS) {
                expect(fixedAddressesBalancesAfter[i].sub(fixedAddressesBalancesBefore[i])).to.be.bignumber.equals(ZERO);
            }
        }

        let isFromNotFixed = notFixedAddresses.indexOf(from) != -1;
        let isToNotFixed = notFixedAddresses.indexOf(to) != -1;
        if (isFromNotFixed && isToNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), lpAmount.add(burnAmount));
        } else if (isFromNotFixed && !isToNotFixed) {
            isNear(notFixedBalancesBefore.sub(notFixedBalancesAfter), amount.sub(distributionAmount));
        } else if (!isFromNotFixed && isToNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), amount.sub(lpAmount).sub(burnAmount));
        } else if (!isFromNotFixed && !isToNotFixed) {
            isNear(notFixedBalancesAfter.sub(notFixedBalancesBefore), distributionAmount);
        }

        if (isFromNotFixed == false) {
            isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        }
        if (isToNotFixed == false) {
            isNear(balanceToAfter.sub(balanceToBefore), amount.sub(lpAmount).sub(burnAmount).sub(distributionAmount));
        }

        for (let i = 0; i < notFixedAddresses.length; ++i) {
            let amountToGet = notFixedAddressesBalancesAfter[i].mul(distributionAmount).div(notFixedBalancesAfter);
            if (notFixedAddresses[i] != from && notFixedAddresses[i] != to) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet
                );
            } else if (notFixedAddresses[i] == to) {
                isNear(
                    notFixedAddressesBalancesAfter[i].sub(notFixedAddressesBalancesBefore[i]),
                    amountToGet.add(amount).sub(lpAmount).sub(burnAmount).sub(distributionAmount)
                );
            } else if (notFixedAddresses[i] == from) {
                isNear(
                    notFixedAddressesBalancesBefore[i].sub(notFixedAddressesBalancesAfter[i]),
                    amount.sub(amountToGet)
                );
            }
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
    expect(x.sub(y).abs()).to.be.bignumber.below(TEN);
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

function removeFromArray(arr, value) {
    let index = arr.indexOf(value);
    expect(index).not.to.be.equals(-1);
    arr.splice(index, 1);
    return arr;
}