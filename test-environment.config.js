module.exports = {
    accounts: {
        amount: 20,
        ether: 100000000000000000,
    },

    contracts: {
        type: 'truffle', // Contract abstraction to use: 'truffle' for @truffle/contract or 'web3' for web3-eth-contract
        defaultGas: 8e6, // Maximum gas for contract calls (when unspecified)

        defaultGasPrice: 20e9,
        artifactsDir: 'build/contracts',
    },

    node: {
        gasLimit: 8e6,
        gasPrice: 20e9,
        // fork: 'https://mainnet.infura.io/v3/{token}@{blocknumber}', // An url to Ethereum node to use as a source for a fork
        // unlocked_accounts: ['0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'], // Array of addresses specifying which accounts should be unlocked.
        // allowUnlimitedContractSize: true, // Allows unlimited contract sizes.
    },
};