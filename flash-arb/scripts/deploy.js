/**
 * Deploy FlashArbitrage to Base mainnet or Base Sepolia.
 *
 *   npm run deploy:base     — mainnet
 *   npm run deploy:sepolia  — testnet
 *
 * After deploy, call addRouter() for each DEX you want to use.
 */

const { ethers, network, run } = require("hardhat");

// ── Chain addresses ───────────────────────────────────────────────────────────
const ADDRESSES = {
  // Base Mainnet (chainId 8453)
  8453: {
    aaveAddressesProvider: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64b",
    uniswapV3Router:       "0x2626664c2603336E57B271c5C0b26F421741e481",
    aerodromeRouter:       "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
  },
  // Base Sepolia Testnet (chainId 84532)
  84532: {
    // Aave V3 Sepolia
    aaveAddressesProvider: "0xd449FeD49d9C443688d6816fE6872F21402e41de",
    uniswapV3Router:       "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    aerodromeRouter:       "0x0000000000000000000000000000000000000000", // N/A on testnet
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId    = (await ethers.provider.getNetwork()).chainId;
  const addrs      = ADDRESSES[Number(chainId)];

  if (!addrs) throw new Error(`Unknown chainId: ${chainId}`);

  console.log(`\nDeploying FlashArbitrage on chain ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const Factory = await ethers.getContractFactory("FlashArbitrage");
  const contract = await Factory.deploy(addrs.aaveAddressesProvider);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log(`✅ FlashArbitrage deployed: ${addr}`);

  // ── Whitelist DEX routers ──────────────────────────────────────────────────
  console.log("\nWhitelisting routers...");
  const tx1 = await contract.addRouter(addrs.uniswapV3Router);
  await tx1.wait();
  console.log(`  ✓ Uniswap V3 Router: ${addrs.uniswapV3Router}`);

  if (addrs.aerodromeRouter !== "0x0000000000000000000000000000000000000000") {
    const tx2 = await contract.addRouter(addrs.aerodromeRouter);
    await tx2.wait();
    console.log(`  ✓ Aerodrome Router: ${addrs.aerodromeRouter}`);
  }

  // ── Verify on Basescan ────────────────────────────────────────────────────
  if (process.env.BASESCAN_API_KEY && network.name !== "hardhat") {
    console.log("\nWaiting 30s for Basescan to index...");
    await new Promise(r => setTimeout(r, 30_000));
    try {
      await run("verify:verify", {
        address:              addr,
        constructorArguments: [addrs.aaveAddressesProvider],
      });
      console.log("✅ Contract verified on Basescan");
    } catch (e) {
      console.warn("Verification failed (may already be verified):", e.message);
    }
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("Add to your .env:");
  console.log(`FLASH_ARB_CONTRACT=${addr}`);
  console.log("──────────────────────────────────────────────\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
