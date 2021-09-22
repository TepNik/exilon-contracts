require("dotenv").config();
const { MULTISEND_DEPLOY_GASLIMIT } = process.env;

const Multisend = artifacts.require("Multisend");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    await deployer.deploy(Multisend, { gas: MULTISEND_DEPLOY_GASLIMIT });
    let MultisendInst = await Multisend.deployed();

    console.log("Multisend =", MultisendInst.address);
};
