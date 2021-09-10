const Migrations = artifacts.require("Migrations");

module.exports = async function (deployer, network) {
    if (network != "bsc" && network != "bscTestnet") {
        return;
    }

    await deployer.deploy(Migrations);
    let MigrationsInst = await Migrations.deployed();

    console.log("Migrations =", MigrationsInst.address);
};
