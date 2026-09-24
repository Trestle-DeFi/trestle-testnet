const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log("Network:", networkName, "(chainId:", chainId, ")");
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "native\n");

  const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
  const BUYBACK_BURN = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
  const GOV_SUPPLY = hre.ethers.parseEther("1000000");
  const CHAINLINK_FEEDS = {
    amoy: "0x001382149eBa3441043c1c66972b4772963f5D43", // POL/USD
    arbitrumSepolia: "0x26dA680D98e805D54f0934f46b4669149c14d1cA", // ETH/USD
    baseSepolia: "0x4Adc67696BA383F43dD60a9e78F2C97F4FcF617B", // ETH/USD
  };
  // NOTE (2026-08): Chainlink has deprecated/sunset these testnet aggregators —
  // syncPrice() will fail. Post-deploy below falls back to admin setManualPrice().
  const MANUAL_PRICES = {
    amoy: 20000000n, // $0.20 POL/USD (8 decimals)
    arbitrumSepolia: 300000000000n, // $3000 ETH/USD (8 decimals)
    baseSepolia: 300000000000n, // $3000 ETH/USD (8 decimals)
  };
  const PRICE_FEED = CHAINLINK_FEEDS[networkName] || CHAINLINK_FEEDS.amoy;

  const deployed = {};

  // 1. Mock Governance Token
  console.log("[1/7] Deploying MockGovernanceToken...");
  const GovToken = await hre.ethers.getContractFactory("MockGovernanceToken");
  const govToken = await GovToken.deploy("Trestle Governance", "tGOV", 18, GOV_SUPPLY);
  await govToken.waitForDeployment();
  deployed.govToken = await govToken.getAddress();
  console.log("  ->", deployed.govToken);

  // 2. Fee Distributor
  console.log("[2/7] Deploying FeeDistributor...");
  const FeeDistributor = await hre.ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(TREASURY, BUYBACK_BURN);
  await feeDistributor.waitForDeployment();
  deployed.feeDistributor = await feeDistributor.getAddress();
  console.log("  ->", deployed.feeDistributor);

  // 3. Digital Goods
  console.log("[3/7] Deploying DigitalGoods...");
  const DigitalGoods = await hre.ethers.getContractFactory("DigitalGoods");
  const digitalGoods = await DigitalGoods.deploy(TREASURY);
  await digitalGoods.waitForDeployment();
  deployed.digitalGoods = await digitalGoods.getAddress();
  console.log("  ->", deployed.digitalGoods);

  // 4. Freelancer Escrow
  console.log("[4/7] Deploying FreelancerEscrow...");
  const FreelancerEscrow = await hre.ethers.getContractFactory("FreelancerEscrow");
  const freelancerEscrow = await FreelancerEscrow.deploy(TREASURY);
  await freelancerEscrow.waitForDeployment();
  deployed.freelancerEscrow = await freelancerEscrow.getAddress();
  console.log("  ->", deployed.freelancerEscrow);

  // 5. User Profile
  console.log("[5/7] Deploying UserProfile...");
  const UserProfile = await hre.ethers.getContractFactory("UserProfile");
  const userProfile = await UserProfile.deploy(deployed.govToken, deployer.address);
  await userProfile.waitForDeployment();
  deployed.userProfile = await userProfile.getAddress();
  console.log("  ->", deployed.userProfile);

  // Post-deploy hook wiring
  console.log("  Wiring UserProfile hooks...");
  await (await userProfile.setPlatformContract(deployed.digitalGoods, true)).wait();
  await (await userProfile.setPlatformContract(deployed.freelancerEscrow, true)).wait();
  await (await digitalGoods.setUserProfile(deployed.userProfile)).wait();
  await (await freelancerEscrow.setUserProfile(deployed.userProfile)).wait();
  console.log("  -> hooks connected to DigitalGoods & FreelancerEscrow");

  // 6. Mock Stablecoins
  console.log("[6/7] Deploying Mock Stablecoins...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6, hre.ethers.parseUnits("1000000", 6));
  await mockUSDC.waitForDeployment();
  deployed.mockUSDC = await mockUSDC.getAddress();
  console.log("  USDC ->", deployed.mockUSDC);

  const mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 6, hre.ethers.parseUnits("1000000", 6));
  await mockUSDT.waitForDeployment();
  deployed.mockUSDT = await mockUSDT.getAddress();
  console.log("  USDT ->", deployed.mockUSDT);

  const mockXNOBT = await MockERC20.deploy("Mock xNOBT", "xNOBT", 18, GOV_SUPPLY);
  await mockXNOBT.waitForDeployment();
  deployed.mockXNOBT = await mockXNOBT.getAddress();
  console.log("  xNOBT ->", deployed.mockXNOBT);

  const mockXBRT = await MockERC20.deploy("Mock xBRT", "xBRT", 18, GOV_SUPPLY);
  await mockXBRT.waitForDeployment();
  deployed.mockXBRT = await mockXBRT.getAddress();
  console.log("  xBRT ->", deployed.mockXBRT);

  // 7. Digital RWA (Chainlink + token-gated whitelist via MockUSDC)
  console.log("[7/7] Deploying DigitalRWA...");
  const RWA_META = "ipfs://QmPlaceholder";
  const MIN_WHITELIST_BALANCE = hre.ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)
  const DigitalRWA = await hre.ethers.getContractFactory("DigitalRWA");
  const digitalRWA = await DigitalRWA.deploy(
    "Trestle Real Asset 1", "TRA1",
    RWA_META, GOV_SUPPLY, deployer.address,
    deployed.mockUSDC, MIN_WHITELIST_BALANCE,
    PRICE_FEED
  );
  await digitalRWA.waitForDeployment();
  deployed.digitalRWA = await digitalRWA.getAddress();
  console.log("  ->", deployed.digitalRWA);

  // 8. Post-deploy configuration
  console.log("\n[8/8] Post-deploy configuration...");

  // Allow USDC + USDT on DigitalGoods
  const dg = await hre.ethers.getContractAt("DigitalGoods", deployed.digitalGoods);
  await dg.setTokenAllowed(deployed.mockUSDC, true);
  await dg.setTokenAllowed(deployed.mockUSDT, true);
  console.log("  DigitalGoods: USDC + USDT allowed");

  // Allow USDC + USDT on FreelancerEscrow
  const fe = await hre.ethers.getContractAt("FreelancerEscrow", deployed.freelancerEscrow);
  await fe.setTokenAllowed(deployed.mockUSDC, true);
  await fe.setTokenAllowed(deployed.mockUSDT, true);
  console.log("  FreelancerEscrow: USDC + USDT allowed");

  // Link FeeDistributor
  const feeDist = await hre.ethers.getContractAt("FeeDistributor", deployed.feeDistributor);
  // yieldVault set later if needed

  // Link FreelancerEscrow to FeeDistributor
  await fe.setFeeDistributor(deployed.feeDistributor);
  console.log("  FreelancerEscrow: linked to FeeDistributor");

  // Sync DigitalRWA price
  const rwa = await hre.ethers.getContractAt("DigitalRWA", deployed.digitalRWA);
  try {
    await rwa.syncPrice();
    const price = await rwa.currentPrice();
    console.log("  DigitalRWA: price synced =", hre.ethers.formatUnits(price, 8));
  } catch (e) {
    console.log("  DigitalRWA: syncPrice skipped —", e.message?.slice(0, 80));
    // Chainlink testnet feeds are deprecated — fall back to admin manual price
    try {
      await rwa.setManualPrice(MANUAL_PRICES[networkName] ?? MANUAL_PRICES.amoy);
      const price = await rwa.currentPrice();
      console.log("  DigitalRWA: manual price set =", hre.ethers.formatUnits(price, 8), "USD");
    } catch (e2) {
      console.log("  DigitalRWA: setManualPrice failed —", e2.message?.slice(0, 80));
    }
  }

  // Summary
  console.log("\n============================================");
  console.log("Deployment Summary —", networkName);
  console.log("============================================");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`  ${name}: ${addr}`);
  }
  console.log("============================================");

  // Verify on non-hardhat networks
  if (networkName !== "hardhat") {
    console.log("\nVerifying contracts...");
    await verify("MockGovernanceToken", deployed.govToken, ["Trestle Governance", "tGOV", 18, GOV_SUPPLY]);
    await verify("FeeDistributor", deployed.feeDistributor, [TREASURY, BUYBACK_BURN]);
    await verify("DigitalGoods", deployed.digitalGoods, [TREASURY]);
    await verify("FreelancerEscrow", deployed.freelancerEscrow, [TREASURY]);
    await verify("UserProfile", deployed.userProfile, [deployed.govToken, deployer.address]);
    await verify("MockERC20", deployed.mockUSDC, ["Mock USDC", "USDC", 6, hre.ethers.parseUnits("1000000", 6)]);
    await verify("MockERC20", deployed.mockUSDT, ["Mock USDT", "USDT", 6, hre.ethers.parseUnits("1000000", 6)]);
    await verify("MockERC20", deployed.mockXNOBT, ["Mock xNOBT", "xNOBT", 18, GOV_SUPPLY]);
    await verify("MockERC20", deployed.mockXBRT, ["Mock xBRT", "xBRT", 18, GOV_SUPPLY]);
    await verify("DigitalRWA", deployed.digitalRWA, [
      "Trestle Real Asset 1", "TRA1", RWA_META, GOV_SUPPLY, deployer.address,
      deployed.mockUSDC, MIN_WHITELIST_BALANCE, PRICE_FEED
    ]);
  }
}

async function verify(name, address, args) {
  console.log(`  ${name}...`);
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log(`  \u2713 Verified`);
  } catch (e) {
    console.log(`  \u2717 ${e.message.slice(0, 120)}`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
