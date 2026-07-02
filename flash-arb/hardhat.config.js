require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env" });

const PRIVATE_KEY  = process.env.DEPLOYER_PRIVATE_KEY  || "0x" + "0".repeat(64);
const BASE_RPC     = process.env.BASE_RPC_URL           || "https://mainnet.base.org";
const SEPOLIA_RPC  = process.env.BASE_SEPOLIA_RPC_URL   || "https://sepolia.base.org";
const BASESCAN_KEY = process.env.BASESCAN_API_KEY       || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },

  networks: {
    // ── Base Mainnet ──────────────────────────────────────────────────────
    base: {
      url:      BASE_RPC,
      accounts: [PRIVATE_KEY],
      chainId:  8453,
    },

    // ── Base Sepolia Testnet ──────────────────────────────────────────────
    baseSepolia: {
      url:      SEPOLIA_RPC,
      accounts: [PRIVATE_KEY],
      chainId:  84532,
    },

    // ── Fork for local tests ──────────────────────────────────────────────
    hardhat: {
      forking: process.env.FORK
        ? {
            url:         BASE_RPC,
            blockNumber: parseInt(process.env.FORK_BLOCK || "0") || undefined,
          }
        : undefined,
      chainId: 8453,
    },
  },

  etherscan: {
    apiKey: {
      base:        BASESCAN_KEY,
      baseSepolia: BASESCAN_KEY,
    },
    customChains: [
      {
        network:    "base",
        chainId:    8453,
        urls: {
          apiURL:      "https://api.basescan.org/api",
          browserURL:  "https://basescan.org",
        },
      },
      {
        network:    "baseSepolia",
        chainId:    84532,
        urls: {
          apiURL:      "https://api-sepolia.basescan.org/api",
          browserURL:  "https://sepolia.basescan.org",
        },
      },
    ],
  },

  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    currency: "USD",
  },
};
