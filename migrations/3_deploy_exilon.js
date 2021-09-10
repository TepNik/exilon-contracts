require("dotenv").config();
const {
    EXILON_DEPLOY_GASLIMIT,
    DEX_ROUTER_MAINNET,
    DEX_ROUTER_TESTNET,
    BUSD_WBNB_PAIR_MAINNET,
    BUSD_WBNB_PAIR_TESTNET,
} = process.env;

const Exilon = artifacts.require("Exilon");
const Distribution = artifacts.require("Distribution");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    let DistributionInst = await Distribution.deployed();

    let routerAddress;
    let usdWethPair;
    if (network == "bsc") {
        routerAddress = DEX_ROUTER_MAINNET;
        usdWethPair = BUSD_WBNB_PAIR_MAINNET;
    } else {
        routerAddress = DEX_ROUTER_TESTNET;
        usdWethPair = BUSD_WBNB_PAIR_TESTNET;
    }

    await deployer.deploy(
        Exilon,
        routerAddress,
        usdWethPair,
        [DistributionInst.address],
        DistributionInst.address,
        { gas: EXILON_DEPLOY_GASLIMIT }
    );
    let ExilonInst = await Exilon.deployed();

    console.log("Exilon =", ExilonInst.address);
};
