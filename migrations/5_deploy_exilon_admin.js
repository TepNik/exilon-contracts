require("dotenv").config();
const { EXILON_ADMIN_DEPLOY_GASLIMIT } = process.env;

const ExilonAdmin = artifacts.require("ExilonAdmin");
const Exilon = artifacts.require("Exilon");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    let ExilonInst = await Exilon.deployed();

    await deployer.deploy(ExilonAdmin, ExilonInst.address, { gas: EXILON_ADMIN_DEPLOY_GASLIMIT });
    let ExilonAdminInst = await ExilonAdmin.deployed();

    console.log("ExilonAdmin =", ExilonAdminInst.address);
};
