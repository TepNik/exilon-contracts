require("dotenv").config();
const {} = process.env;

const { constants } = require("@openzeppelin/test-helpers");

const WethReceiver = artifacts.require("WethReceiver");
const Exilon = artifacts.require("Exilon");
const Distribution = artifacts.require("Distribution");
const ExilonAdmin = artifacts.require("ExilonAdmin");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    let ExilonInst = await Exilon.deployed();
    let DistributionInst = await Distribution.deployed();
    let WethReceiverInst = await WethReceiver.deployed();
    let ExilonAdminInst = await ExilonAdmin.deployed();

    if ((await ExilonInst.wethReceiver()) == constants.ZERO_ADDRESS) {
        console.log("Connecting Exilon and WethReceiver");
        await ExilonInst.setWethReceiver(WethReceiverInst.address);
    }

    if ((await DistributionInst.token()) == constants.ZERO_ADDRESS) {
        let tokenLp = await ExilonInst.dexPairExilonWeth();
        console.log("Connecting Exilon and Distribution");
        await DistributionInst.setTokenInfo(ExilonInst.address, tokenLp);
    }

    let defaultAdminRole = await ExilonInst.DEFAULT_ADMIN_ROLE();
    if (!(await ExilonInst.hasRole(defaultAdminRole, ExilonAdminInst.address))) {
        console.log("Connecting Exilon and ExilonAdmin");
        await ExilonInst.grantRole(defaultAdminRole, ExilonAdminInst.address);
    }
};
