const HDWalletProvider = require("@truffle/hdwallet-provider");

require("dotenv").config();
const {
    ETHERSCAN_API_KEY,
    BSCSCAN_API_KEY,
    POLYGONSCAN_API_KEY,
    MNEMONIC,
    INFURA_ID_PROJECT,

    DEFAULT_OPERATIONS_GASLIMIT,

    ETH_MAINNET_GASPRICE,
    BSC_MAINNET_GASPRICE,
    MATIC_MAINNET_GASPRICE,
    TESTNETS_GASPRICE,
} = process.env;

const Web3 = require("web3");
const web3 = new Web3();

module.exports = {
    plugins: ["truffle-plugin-verify", "truffle-contract-size"],

    api_keys: {
        etherscan: ETHERSCAN_API_KEY,
        bscscan: BSCSCAN_API_KEY,
        polygonscan: POLYGONSCAN_API_KEY,
    },

    networks: {
        /* development: {
            host: "127.0.0.1",
            port: 7545,
            network_id: "*",
            gas: 30000000
        }, */
        ropsten: {
            provider: () =>
                new HDWalletProvider(MNEMONIC, "https://ropsten.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 3,
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, "gwei"),
            confirmations: 1,
            skipDryRun: true,
        },
        mainnet: {
            provider: () =>
                new HDWalletProvider(MNEMONIC, "https://mainnet.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 1,
            gasPrice: web3.utils.toWei(ETH_MAINNET_GASPRICE, "gwei"),
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            skipDryRun: false,
        },
        kovan: {
            provider: () =>
                new HDWalletProvider(MNEMONIC, "https://kovan.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 42,
            confirmations: 2,
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, "gwei"),
            skipDryRun: true,
        },
        rinkeby: {
            provider: () =>
                new HDWalletProvider(MNEMONIC, "https://rinkeby.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 4,
            confirmations: 2,
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, "gwei"),
            skipDryRun: true,
        },
        bscTestnet: {
            provider: () =>
                new HDWalletProvider(MNEMONIC, "https://data-seed-prebsc-2-s2.binance.org:8545"),
            network_id: 97,
            confirmations: 2,
            timeoutBlocks: 200,
            gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, "gwei"),
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            skipDryRun: true,
        },
        bsc: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://bsc-dataseed3.binance.org"),
            network_id: 56,
            confirmations: 2,
            timeoutBlocks: 200,
            gasPrice: web3.utils.toWei(BSC_MAINNET_GASPRICE, "gwei"),
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            skipDryRun: true,
        },
        maticMainnet: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://rpc-mainnet.maticvigil.com"),
            network_id: 137,
            confirmations: 2,
            timeoutBlocks: 200,
            gasPrice: web3.utils.toWei(MATIC_MAINNET_GASPRICE, "gwei"),
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            skipDryRun: false,
        },
        maticTestnet: {
            provider: () =>
                new HDWalletProvider(MNEMONIC, "https://matic-mumbai.chainstacklabs.com"),
            network_id: 80001,
            confirmations: 2,
            timeoutBlocks: 200,
            gasPrice: web3.utils.toWei(TESTNETS_GASPRICE, "gwei"),
            gas: DEFAULT_OPERATIONS_GASLIMIT,
            skipDryRun: true,
        },
    },

    compilers: {
        solc: {
            version: "0.8.7",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
            },
        },
    },
};
