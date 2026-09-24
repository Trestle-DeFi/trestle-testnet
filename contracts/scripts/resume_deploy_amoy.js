const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Resume script for the Amoy deploy_all.js run that aborted at UserProfile
// (gas-price spike). Follows best-deploy-contract.md:
//  - split deployment and initialization, resumable via on-chain checkpoints
//    (dg.userProfile() / fe.feeDistributor() tell us what's already done)
//  - validates the 5 previously deployed contracts have code before proceeding
//  - writes a local checkpoint file after each new deploy
//  - explicit EIP-1559 fee caps (Amoy min tip = 25 gwei, baseFee ~0):
//    up-front cost check = gas * maxFee must fit the balance
const CHAIN_ID = 80002;
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
const EXISTING = {
  govToken: "0x7f411bA9824513a95C591A061F97A0A375B2cB71",
  mockUSDC: "0xBD551EE22321B500AB171885eb77574943aB65E1",
  digitalGoods: "0xBd124c4395b47093CEc78497ec8b098977416396",
  freelancerEscrow: "0x7007DC17282316676c5d1Eb085D3CeC993f92193",
  digitalRWA: "0x7f750E8BD9c9C2685710A03De5307961BC50aF31",
};
const FEE = {
  maxFeePerGas: 80_000_000_000n, // 80 gwei cap (up-front check; baseFee ~0, actual ~25 gwei)
  maxPriorityFeePerGas: 26_000_000_000n, // >= 25 gwei Amoy minimum tip
};
const CHECKPOINT = path.join(__dirname, "amoy-checkpoint.json");

function loadCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
  } catch {
    return { ...EXISTING };
  }
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2) + "\n");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (chainId !== CHAIN_ID) throw new Error(`Expected chainId ${CHAIN_ID}, got ${chainId}`);
  console.log("Deployer:", deployer.address);

  // checkpoint validation: the 5 contracts from the first run must exist
  for (const [name, addr] of Object.entries(EXISTING)) {
    if ((await hre.ethers.provider.getCode(addr)) === "0x") {
      throw new Error(`Checkpoint contract ${name} (${addr}) has no code — aborting`);
    }
  }
  console.log("[Checkpoint] 5 existing contracts verified");

  const cp = loadCheckpoint();
  const dg = await hre.ethers.getContractAt("DigitalGoods", EXISTING.digitalGoods);
  const fe = await hre.ethers.getContractAt("FreelancerEscrow", EXISTING.freelancerEscrow);

  // --- batch 1: deployment (resumable) ---
  // resume order: local checkpoint file (survives pre-wiring crashes) -> on-chain getter -> deploy
  async function resolveExisting(localKey, onchainFn) {
    const local = cp[localKey];
    if (local && (await hre.ethers.provider.getCode(local)) !== "0x") {
      console.log(`[Deploy] ${localKey} from checkpoint:`, local, "- skipping");
      return local;
    }
    const onchain = await onchainFn();
    if (onchain !== hre.ethers.ZeroAddress) {
      cp[localKey] = onchain;
      saveCheckpoint(cp);
      console.log(`[Deploy] ${localKey} already on-chain:`, onchain, "- skipping");
      return onchain;
    }
    return null;
  }

  let userProfile = await resolveExisting("userProfile", () => dg.userProfile());
  if (!userProfile) {
    console.log("[Deploy] UserProfile...");
    const up = await (await hre.ethers.getContractFactory("UserProfile")).deploy(
      EXISTING.govToken, deployer.address, FEE
    );
    await up.waitForDeployment();
    userProfile = await up.getAddress();
    cp.userProfile = userProfile;
    saveCheckpoint(cp);
    console.log("  userProfile:", userProfile, "(checkpoint saved)");
  }

  let feeDistributor = await resolveExisting("feeDistributor", () => fe.feeDistributor());
  if (!feeDistributor) {
    console.log("[Deploy] FeeDistributor...");
    const fd = await (await hre.ethers.getContractFactory("FeeDistributor")).deploy(
      TREASURY, TREASURY, FEE
    );
    await fd.waitForDeployment();
    feeDistributor = await fd.getAddress();
    cp.feeDistributor = feeDistributor;
    saveCheckpoint(cp);
    console.log("  feeDistributor:", feeDistributor, "(checkpoint saved)");
  }

  // --- batch 2: initialization (idempotent) ---
  console.log("[Wiring hooks]...");
  const upc = await hre.ethers.getContractAt("UserProfile", userProfile);
  await (await upc.setPlatformContract(EXISTING.digitalGoods, true, FEE)).wait();
  await (await upc.setPlatformContract(EXISTING.freelancerEscrow, true, FEE)).wait();
  await (await dg.setUserProfile(userProfile, FEE)).wait();
  await (await fe.setUserProfile(userProfile, FEE)).wait();
  console.log("  -> hooks connected");

  console.log("[Post-deploy configuration]...");
  await (await dg.setTokenAllowed(EXISTING.mockUSDC, true, FEE)).wait();
  console.log("  DigitalGoods: USDC allowed");
  await (await fe.setTokenAllowed(EXISTING.mockUSDC, true, FEE)).wait();
  await (await fe.setFeeDistributor(feeDistributor, FEE)).wait();
  console.log("  FreelancerEscrow: USDC allowed, linked to FeeDistributor");
  const rwa = await hre.ethers.getContractAt("DigitalRWA", EXISTING.digitalRWA);
  try {
    await (await rwa.syncPrice(FEE)).wait();
    await new Promise(r => setTimeout(r, 3000));
    const synced = await rwa.currentPrice();
    if (synced > 0n) {
      console.log("  DigitalRWA: price synced =", hre.ethers.formatUnits(synced, 8));
    } else {
      throw new Error("feed returned 0");
    }
  } catch (e) {
    await (await rwa.setManualPrice(20000000n, FEE)).wait();
    await new Promise(r => setTimeout(r, 3000));
    console.log("  DigitalRWA: manual price set =", hre.ethers.formatUnits(await rwa.currentPrice(), 8));
  }

  saveCheckpoint({ ...cp, userProfile, feeDistributor });
  console.log("\nDEPLOYED (resumed) — Polygon Amoy");
  for (const [k, v] of Object.entries({ ...EXISTING, userProfile, feeDistributor })) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
