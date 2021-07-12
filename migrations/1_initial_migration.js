const Migrations = artifacts.require("Migrations");

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development")
        return;

    await deployer.deploy(
        Migrations
    );
    let MigrationsInst = await Migrations.deployed();

    console.log("Migrations =", MigrationsInst.address);
};
