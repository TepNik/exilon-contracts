require('dotenv').config();
const {
    DISTRIBUTION_DEPLOY_GASLIMIT
} = process.env;

const Distribution = artifacts.require("Distribution");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    await deployer.deploy(
        Distribution,
        { gas: DISTRIBUTION_DEPLOY_GASLIMIT }
    );
    let DistributionInst = await Distribution.deployed();

    console.log("Distribution =", DistributionInst.address);
};