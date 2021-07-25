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

let PancakeFactoryInst;
let PancakeRouterInst;
let WETHInst;
let ExilonInst;
let ExilonDexPairInst;

let fixedAddresses = [];
let notFixedAddresses = [];

describe('Exilon contract tests', () => {
    const [
        feeToSetter,
        exilonAdmin,
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
            { from: exilonAdmin }
        );

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

        expect(await ExilonInst.name()).to.be.equals(NAME);
        expect(await ExilonInst.symbol()).to.be.equals(SYMBOL);
        expect(await ExilonInst.decimals()).to.be.bignumber.equals(DECIMALS);

        expect(await ExilonInst.totalSupply()).to.be.bignumber.equals(TOTAL_SUPPLY);

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
                    [EIGHT, ONE, ONE]
                );

                // test trasnfer of part balance
                await checkTransfer(
                    distributionAddress2,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress2)).div(THREE),
                    [EIGHT, ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                // test transfer part of balance
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress6,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                // test trasnfer of full balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [EIGHT, ONE, ONE]
                );

                // test transfer less than half balance from fixed to not fixed
                await checkTransfer(
                    distributionAddress5,
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(THREE),
                    [EIGHT, ONE, ONE]
                );

                // test transfer of half balance from not fixed to fixed
                await checkTransfer(
                    distributionAddress1,
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(THREE),
                    [EIGHT, ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                    [new BN("23"), ONE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("200")));
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                    [new BN("22"), ONE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("350")));

                let startBlock = blocknumber.add(new BN("350"));
                let step = new BN("100");
                for (let i = 0; i < 13; ++i) {
                    let index = new BN(i);
                    await checkSell(
                        distributionAddress1,
                        (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                        [(new BN("21")).sub(index), ONE, ONE]
                    );

                    let newBlocknumber = startBlock.add(step.mul(index.add(ONE)));
                    await time.advanceBlockTo(newBlocknumber);
                }

                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TWO).sub(ONE),
                    [EIGHT, ONE, ONE]
                );
                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TWO),
                    [new BN("13"), ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                    [new BN("23"), ONE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("200")));
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                    [new BN("22"), ONE, ONE]
                );
                await time.advanceBlockTo(blocknumber.add(new BN("350")));

                let startBlock = blocknumber.add(new BN("350"));
                let step = new BN("100");
                for (let i = 0; i < 13; ++i) {
                    let index = new BN(i);
                    await checkSell(
                        distributionAddress5,
                        (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                        [(new BN("21")).sub(index), ONE, ONE]
                    );

                    let newBlocknumber = startBlock.add(step.mul(index.add(ONE)));
                    await time.advanceBlockTo(newBlocknumber);
                }

                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TWO).sub(ONE),
                    [EIGHT, ONE, ONE]
                );
                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TWO),
                    [new BN("13"), ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkSell(
                    distributionAddress1,
                    (await ExilonInst.balanceOf(distributionAddress1)).div(TEN),
                    [EIGHT, ONE, ONE]
                );

                await checkSell(
                    distributionAddress1,
                    await ExilonInst.balanceOf(distributionAddress1),
                    [EIGHT, ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkSell(
                    distributionAddress5,
                    (await ExilonInst.balanceOf(distributionAddress5)).div(TEN),
                    [EIGHT, ONE, ONE]
                );

                await checkSell(
                    distributionAddress5,
                    await ExilonInst.balanceOf(distributionAddress5),
                    [EIGHT, ONE, ONE]
                );
            })
        })
    })

    describe("Adding and removing liquidity", () => {
        let liquidityAmount = ONE_ETH.mul(new BN("8000000000000"));

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
                    [EIGHT, ONE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("23"), ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("13"), ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("23"), ONE, ONE]
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
                    [EIGHT, ONE, ONE]
                );

                await checkAddLiquidity(
                    exilonAdmin,
                    await ExilonInst.balanceOf(exilonAdmin),
                    [new BN("13"), ONE, ONE]
                );
            })
        })
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

        //isNear(balanceFromBefore.sub(balanceFromAfter), amount);
        //isNear(balanceToAfter.sub(balanceToBefore), amount.sub(lpAmount).sub(burnAmount).sub(distributionAmount));
        isNear(feeAmountAfter.sub(feeAmountBefore), lpAmount);
        isNear(burnAddressBalanceAfter.sub(burnAddressBalanceBefore), burnAmount);

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