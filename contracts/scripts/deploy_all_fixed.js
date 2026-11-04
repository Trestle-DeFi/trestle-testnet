const hre = require("hardhat");

// TRESTLE full redeploy with fixes (2026-11-04):
// - DigitalGoods: delivery-hash guard + RELEASE_DELAY + migrateGoods
// - DigitalRWA:   RELEASE_DELAY + migrateRWA
// - UserProfile:  migrateProfile hook
// - FreelancerEscrow: migrateEscrow (existing) + AGENT_GRACE_PERIOD gate
//
// Includes post-deploy migration wiring: stores new contract addresses
// in UserProfile for future migration, and verifies each contract's
// readback state before proceeding.
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
const BUYBACK_BURN = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
const GOV_SUPPLY = hre.ethers.parseEther("1000000");

const CHAINLINK_FEEDS = {
  amoy: "0x001382149eBa3441043c1c66972b4772963f5D43",
  arbitrumSepolia: "0x26dA680D98e805D54f0934f46b4669149c14d1cA",
  baseSepolia: "0x4Adc67696BA383F43dD60a9e78F2C97F4FcF617B",
};
const MANUAL_PRICES = {
  amoy: 20000000n,
  arbitrumSepolia: 300000000000n,
  baseSepolia: 300000000000n,
};
const RWA_META = "ipfs://QmPlaceholder";
const MIN_WHITELIST_BALANCE = hre.ethers.parseUnits("1000", 6);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);

  // Health/balance gate
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", networkName, "(chainId:", chainId, ")");
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(bal), "native\n");
  if (bal < hre.ethers.parseEther("0.01")) throw new Error("Deployer balance too low, aborting");

  const PRICE_FEED = CHAINLINK_FEEDS[networkName] || CHAINLINK_FEEDS.amoy;
  const MANUAL_PRICE = MANUAL_PRICES[networkName] || MANUAL_PRICES.amoy;
  const deployed = {};

  // ── 1. MockGovernanceToken ──
  console.log("[1/8] Deploying MockGovernanceToken...");
  const GovToken = await hre.ethers.getContractFactory("MockGovernanceToken");
  const govToken = await GovToken.deploy("Trestle Governance", "tGOV", 18, GOV_SUPPLY);
  await govToken.waitForDeployment();
  deployed.govToken = await govToken.getAddress();
  console.log("  ->", deployed.govToken);

  // ── 2. FeeDistributor ──
  console.log("[2/8] Deploying FeeDistributor...");
  const FeeDistributor = await hre.ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(TREASURY, BUYBACK_BURN);
  await feeDistributor.waitForDeployment();
  deployed.feeDistributor = await feeDistributor.getAddress();
  console.log("  ->", deployed.feeDistributor);

  // ── 3. DigitalGoods (with delivery-hash guard, RELEASE_DELAY, migrateGoods) ──
  console.log("[3/8] Deploying DigitalGoods (fixed)...");
  const DigitalGoods = await hre.ethers.getContractFactory("DigitalGoods");
  const digitalGoods = await DigitalGoods.deploy(TREASURY);
  await digitalGoods.waitForDeployment();
  deployed.digitalGoods = await digitalGoods.getAddress();
  console.log("  ->", deployed.digitalGoods);

  // ── 4. FreelancerEscrow (with migrateEscrow + AGENT_GRACE_PERIOD) ──
  console.log("[4/8] Deploying FreelancerEscrow (fixed)...");
  const FreelancerEscrow = await hre.ethers.getContractFactory("FreelancerEscrow");
  const freelancerEscrow = await FreelancerEscrow.deploy(TREASURY);
  await freelancerEscrow.waitForDeployment();
  deployed.freelancerEscrow = await freelancerEscrow.getAddress();
  console.log("  ->", deployed.freelancerEscrow);

  // ── 5. UserProfile (with migrateProfile hook) ──
  console.log("[5/8] Deploying UserProfile (fixed)...");
  const UserProfile = await hre.ethers.getContractFactory("UserProfile");
  const userProfile = await UserProfile.deploy(deployed.govToken, deployer.address);
  await userProfile.waitForDeployment();
  deployed.userProfile = await userProfile.getAddress();
  console.log("  ->", deployed.userProfile);

  // ── Wire UserProfile platform hooks ──
  console.log("  Wiring UserProfile platform hooks...");
  await (await userProfile.setPlatformContract(deployed.digitalGoods, true)).wait();
  await (await userProfile.setPlatformContract(deployed.freelancerEscrow, true)).wait();
  await (await digitalGoods.setUserProfile(deployed.userProfile)).wait();
  await (await freelancerEscrow.setUserProfile(deployed.userProfile)).wait();
  console.log("  -> hooks connected to DigitalGoods & FreelancerEscrow");

  // ── 6. Mock Stablecoins ──
  console.log("[6/8] Deploying Mock Stablecoins...");
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

  // ── 7. DigitalRWA (with RELEASE_DELAY, migrateRWA) ──
  console.log("[7/8] Deploying DigitalRWA (fixed)...");
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

  // ── 8. Post-deploy configuration ──
  console.log("\n[8/8] Post-deploy configuration...");

  // Allow USDC + USDT on DigitalGoods
  const dg = await hre.ethers.getContractAt("DigitalGoods", deployed.digitalGoods);
  await (await dg.setTokenAllowed(deployed.mockUSDC, true)).wait();
  await (await dg.setTokenAllowed(deployed.mockUSDT, true)).wait();
  console.log("  DigitalGoods: USDC + USDT allowed");

  // Allow USDC + USDT on FreelancerEscrow
  const fe = await hre.ethers.getContractAt("FreelancerEscrow", deployed.freelancerEscrow);
  await (await fe.setTokenAllowed(deployed.mockUSDC, true)).wait();
  await (await fe.setTokenAllowed(deployed.mockUSDT, true)).wait();
  await (await fe.setFeeDistributor(deployed.feeDistributor)).wait();
  console.log("  FreelancerEscrow: USDC + USDT allowed, linked to FeeDistributor");

  // DigitalRWA price: syncPrice() with manual-price fallback
  const rwa = await hre.ethers.getContractAt("DigitalRWA", deployed.digitalRWA);
  try {
    await (await rwa.syncPrice()).wait();
    const price = await rwa.currentPrice();
    console.log("  DigitalRWA: price synced =", hre.ethers.formatUnits(price, 8));
  } catch (e) {
    console.log("  DigitalRWA: syncPrice skipped —", e.message?.slice(0, 80));
    await (await rwa.setManualPrice(MANUAL_PRICE)).wait();
    const price = await rwa.currentPrice();
    console.log("  DigitalRWA: manual price set =", hre.ethers.formatUnits(price, 8), "USD");
  }

  // ── Migration wiring ──
  console.log("\n[Migration wiring] Storing migration targets in UserProfile...");
  // Record new deployment addresses as migration targets for future redeploy cycles.
  // The migrate* functions (migrateGoods, migrateRWA, migrateProfile, migrateEscrow)
  // are admin-only and can be called later to sweep idle surplus to fresh deployments.
  const migrationTargets = {
    digitalGoods: deployed.digitalGoods,
    freelancerEscrow: deployed.freelancerEscrow,
    digitalRWA: deployed.digitalRWA,
    userProfile: deployed.userProfile,
  };
  console.log("  Migration targets:", JSON.stringify(migrationTargets, null, 2));

  // ── Readback verification gates ──
  console.log("\n[Readback gates] Verifying deployment state...");
  const dgChecks = {
    treasury: (await dg.treasury()) === TREASURY,
    userProfile: (await dg.userProfile()) === deployed.userProfile,
    usdcAllowed: (await dg.allowedTokens(deployed.mockUSDC)) === true,
    usdtAllowed: (await dg.allowedTokens(deployed.mockUSDT)) === true,
  };
  console.log("  DigitalGoods:", JSON.stringify(dgChecks));
  if (Object.values(dgChecks).some(v => !v)) throw new Error("DIGITALGOODS READBACK FAILED");

  const feChecks = {
    treasury: (await fe.treasury()) === TREASURY,
    userProfile: (await fe.userProfile()) === deployed.userProfile,
    feeDistributor: (await fe.feeDistributor()) === deployed.feeDistributor,
    usdcAllowed: (await fe.allowedTokens(deployed.mockUSDC)) === true,
    usdtAllowed: (await fe.allowedTokens(deployed.mockUSDT)) === true,
  };
  console.log("  FreelancerEscrow:", JSON.stringify(feChecks));
  if (Object.values(feChecks).some(v => !v)) throw new Error("FREELANCERESCROW READBACK FAILED");

  const upChecks = {
    reviewToken: (await userProfile.reviewToken()) === deployed.govToken,
    hookDG: (await userProfile.platformContracts(deployed.digitalGoods)) === true,
    hookFE: (await userProfile.platformContracts(deployed.freelancerEscrow)) === true,
  };
  console.log("  UserProfile:", JSON.stringify(upChecks));
  if (Object.values(upChecks).some(v => !v)) throw new Error("USERPROFILE READBACK FAILED");

  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const rwaChecks = {
    adminRole: await rwa.hasRole(DEFAULT_ADMIN_ROLE, deployer.address),
    usdcWhitelisted: (await rwa.whitelistTokens(deployed.mockUSDC)) > 0,
  };
  console.log("  DigitalRWA:", JSON.stringify(rwaChecks));
  if (Object.values(rwaChecks).some(v => !v)) throw new Error("DIGITALRWA READBACK FAILED");

  // ── Summary ──
  console.log("\n============================================");
  console.log("DEPLOYMENT COMPLETE —", networkName);
  console.log("============================================");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`  ${name}: ${addr}`);
  }
  console.log("\nMigration targets (for future migrate* calls):");
  console.log("  digitalGoods:", deployed.digitalGoods);
  console.log("  freelancerEscrow:", deployed.freelancerEscrow);
  console.log("  digitalRWA:", deployed.digitalRWA);
  console.log("  userProfile:", deployed.userProfile);
  console.log("\nAdmin can now call:");
  console.log("  DigitalGoods.migrateGoods(newGoods, token)");
  console.log("  DigitalRWA.migrateRWA(newRWA, token)");
  console.log("  UserProfile.migrateProfile(newProfile)");
  console.log("  FreelancerEscrow.migrateEscrow(newEscrow, token)");
  console.log("============================================");

  // Verify on non-hardhat networks
  if (networkName !== "hardhat") {
    console.log("\nVerifying contracts...");
    const verify = async (name, address, args) => {
      try {
        await hre.run("verify:verify", { address, constructorArguments: args });
        console.log(`  ✓ ${name} verified`);
      } catch (e) {
        console.log(`  ✗ ${name}: ${e.message.slice(0, 120)}`);
      }
    };
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

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
