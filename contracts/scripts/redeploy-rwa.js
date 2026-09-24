const hre = require("hardhat");

// Redeploys ONLY DigitalRWA (post-oracle-fix version) and wires it up:
// - USDC whitelist via constructor, USDT whitelist post-deploy
// - price: tries Chainlink syncPrice(), falls back to admin setManualPrice()
// Existing addresses below must match frontend/src/config/contracts.ts.
const EXISTING = {
  baseSepolia: {
    govToken: "0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
    mockUSDT: "0x0000000000000000000000000000000000000000",
  },
  arbitrumSepolia: {
    govToken: "0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
    mockUSDT: "0x0000000000000000000000000000000000000000",
  },
  amoy: {
    govToken: "0x7f411bA9824513a95C591A061F97A0A375B2cB71",
    mockUSDC: "0xBD551EE22321B500AB171885eb77574943aB65E1",
    mockUSDT: "0x0000000000000000000000000000000000000000",
  },
};

const CHAINLINK_FEEDS = {
  amoy: "0x001382149eBa3441043c1c66972b4772963f5D43", // ETH/USD — sunset (reverts on all calls)
  arbitrumSepolia: "0x26dA680D98e805D54f0934f46b4669149c14d1cA", // ETH/USD — no code (dead)
  baseSepolia: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1", // ETH/USD — live
};

const MANUAL_PRICES = {
  amoy: 20000000n, // $0.20 POL/USD (8 decimals)
  arbitrumSepolia: 300000000000n, // $3000 ETH/USD (8 decimals)
  baseSepolia: 300000000000n, // $3000 ETH/USD (8 decimals)
};

const RWA_META = "ipfs://QmPlaceholder";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;
  const cfg = EXISTING[networkName];
  if (!cfg) throw new Error(`No config for network ${networkName}`);

  console.log("Network:", networkName);
  console.log("Deploying DigitalRWA from:", deployer.address);

  const GOV_SUPPLY = hre.ethers.parseEther("1000000");
  const MIN_WHITELIST_BALANCE = hre.ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)

  const DigitalRWA = await hre.ethers.getContractFactory("DigitalRWA");
  const rwa = await DigitalRWA.deploy(
    "Trestle Real Asset 1", "TRA1",
    RWA_META, GOV_SUPPLY, deployer.address,
    cfg.mockUSDC, MIN_WHITELIST_BALANCE,
    CHAINLINK_FEEDS[networkName]
  );
  await rwa.waitForDeployment();
  const addr = await rwa.getAddress();
  console.log("\nDigitalRWA deployed:", addr);
  console.log(">>> UPDATE frontend/src/config/contracts.ts digitalRWA + READMEs + STATUS.md <<<\n");

  // USDT holder-gating whitelist (skipped while mockUSDT is not deployed)
  if (cfg.mockUSDT !== hre.ethers.ZeroAddress) {
    await rwa.setWhitelistToken(cfg.mockUSDT, hre.ethers.parseUnits("1000", 18));
    console.log("Whitelist: USDC(1000, constructor) + USDT(1000) set");
  } else {
    console.log("Whitelist: USDC(1000, constructor); USDT skipped (not deployed)");
  }

  // Price
  try {
    await rwa.syncPrice();
    console.log("Price synced from oracle:", hre.ethers.formatUnits(await rwa.currentPrice(), 8));
  } catch {
    await rwa.setManualPrice(MANUAL_PRICES[networkName] ?? MANUAL_PRICES.amoy);
    console.log("Oracle dead — manual price set:", hre.ethers.formatUnits(await rwa.currentPrice(), 8), "USD");
  }

  // Sanity checks
  const price = await rwa.currentPrice();
  const usdtOk = await rwa.whitelistTokens(cfg.mockUSDT);
  console.log("\nSanity: currentPrice =", price.toString(), "| USDT minBalance =", usdtOk.toString());
  if (price === 0n) throw new Error("currentPrice still zero!");
  const verifyArgs = `npx hardhat verify --network ${networkName} ${addr} "Trestle Real Asset 1" "TRA1" "${RWA_META}" ${GOV_SUPPLY} ${deployer.address} ${cfg.mockUSDC} ${MIN_WHITELIST_BALANCE} ${CHAINLINK_FEEDS[networkName]}`;
  console.log("\nVerify with:\n  " + verifyArgs);
  try {
    await hre.run("verify:verify", {
      network: networkName,
      address: addr,
      constructorArguments: [
        "Trestle Real Asset 1", "TRA1", RWA_META, GOV_SUPPLY,
        deployer.address, cfg.mockUSDC, MIN_WHITELIST_BALANCE, CHAINLINK_FEEDS[networkName],
      ],
    });
    console.log("✅ verified on explorer");
  } catch (e) {
    console.log("verify failed (can retry manually):", e.message?.slice(0, 120));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
