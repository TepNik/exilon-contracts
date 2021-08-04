require('dotenv').config();
const {
    WETH_RECIEVER_DEPLOY_GASLIMIT
} = process.env;

const WethReceiver = artifacts.require("WethReceiver");
const Exilon = artifacts.require("Exilon");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    let ExilonInst = await Exilon.deployed();

    await deployer.deploy(
        WethReceiver,
        ExilonInst.address,
        { gas: WETH_RECIEVER_DEPLOY_GASLIMIT }
    );
    let WethReceiverInst = await WethReceiver.deployed();

    console.log("WethReceiver =", WethReceiverInst.address);
};