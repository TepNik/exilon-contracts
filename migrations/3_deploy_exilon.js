require("dotenv").config();
const {
    EXILON_DEPLOY_GASLIMIT,
    DEX_ROUTER_MAINNET,
    DEX_ROUTER_TESTNET,
    BUSD_MAINNET,
    BUSD_TESTNET,
} = process.env;

const Exilon = artifacts.require("Exilon");
const Distribution = artifacts.require("Distribution");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    let DistributionInst = await Distribution.deployed();

    let routerAddress;
    let usdAddress;
    if (network == "bsc") {
        routerAddress = DEX_ROUTER_MAINNET;
        usdAddress = BUSD_MAINNET;
    } else {
        routerAddress = DEX_ROUTER_TESTNET;
        usdAddress = BUSD_TESTNET;
    }

    await deployer.deploy(
        Exilon,
        routerAddress,
        usdAddress,
        [DistributionInst.address],
        DistributionInst.address,
        DistributionInst.address,
        { gas: EXILON_DEPLOY_GASLIMIT }
    );
    let ExilonInst = await Exilon.deployed();

    console.log("Exilon =", ExilonInst.address);
};
