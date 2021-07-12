require('dotenv').config();
const {
} = process.env;

const TestContract = artifacts.require("TestContract");

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development") {
        return;
    }

    await deployer.deploy(
        TestContract//,
        //{ gas: YDR_TOKEN_DEPLOY_GASLIMIT }
    );
    let TestContractInst = await TestContract.deployed();

    console.log("TestContract =", TestContractInst.address);
};