const hre = require("hardhat");

// TRESTLE-ARFAN bug-batch redeploy (2026-10-21): FreelancerEscrow
// (TRST-01/02/04/05/06 + ARFAN-2 deep-discount scaling) and DigitalGoods
// (TRST-03 fee-on-transfer + JKO-4 zero-second dispute + ARFAN-1
// zero-reserve/zero-price, incl. compiled-in DutchAuctionLib fix).
// Resumable per-network batch per best-deploy-contract.md: deployer
// health/balance gate, sequenced steps, readback gate per contract.
// Wiring replicates redeploy_fe_ft1.js (current live shape).
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";

const CHAINS = {
  84532: {
    name: "Base Sepolia",
    userProfile: "0xa1889d658601c7fA649a70516341fF4aac761ca8",
    oldFE: "0x8FBa99052f1424d205D28b44239F5B376aBd9Be6",
    oldDG: "0x89f5394a468343F405285040664Fd77843D2a2e6",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
  },
  421614: {
    name: "Arbitrum Sepolia",
    userProfile: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    oldFE: "0x33226359935b5922F834355ced7D49A66825f92C",
    oldDG: "0x6D6C679279f5C680e5a6ef33306F2e9A78577DCa",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
  },
  80002: {
    name: "Polygon Amoy",
    userProfile: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    oldFE: "0xd1Fdb92B75DD465eB0808b73BFf6389813aB3b65",
    oldDG: "0xBd124c4395b47093CEc78497ec8b098977416396",
    feeDistributor: "0x4104eA3D55F9C2F5818671e5365F801996D83038",
    mockUSDC: "0xBD551EE22321B500AB171885eb77574943aB65E1",
  },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`No config for chainId ${chainId}`);

  // Health/balance gate (best-deploy-contract.md: no RPC work on dry balances)
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", cfg.name, "| Deployer:", deployer.address, "| Balance:", hre.ethers.formatEther(bal));
  if (bal < hre.ethers.parseEther("0.01")) throw new Error("Deployer balance too low, aborting");

  // [1] FreelancerEscrow
  console.log("[1/10] Deploying FreelancerEscrow (TRST + ARFAN-2 fix)...");
  const FreelancerEscrow = await hre.ethers.getContractFactory("FreelancerEscrow");
  const fe = await FreelancerEscrow.deploy(TREASURY);
  await fe.waitForDeployment();
  const newFE = await fe.getAddress();
  console.log("  ->", newFE);

  console.log("[2/10] FE.setUserProfile...");
  await (await fe.setUserProfile(cfg.userProfile)).wait();
  console.log("[3/10] FE.setTokenAllowed(USDC)...");
  await (await fe.setTokenAllowed(cfg.mockUSDC, true)).wait();
  console.log("[4/10] FE.setFeeDistributor...");
  await (await fe.setFeeDistributor(cfg.feeDistributor)).wait();

  console.log("[5/10] Deploying DigitalGoods (TRST-03/JKO-4/ARFAN-1 fix)...");
  const DigitalGoods = await hre.ethers.getContractFactory("DigitalGoods");
  const dg = await DigitalGoods.deploy(TREASURY);
  await dg.waitForDeployment();
  const newDG = await dg.getAddress();
  console.log("  ->", newDG);

  console.log("[6/10] DG.setUserProfile...");
  await (await dg.setUserProfile(cfg.userProfile)).wait();
  console.log("[7/10] DG.setTokenAllowed(USDC)...");
  await (await dg.setTokenAllowed(cfg.mockUSDC, true)).wait();

  console.log("[8/10] Re-pointing UserProfile hooks (new on, old off)...");
  const up = await hre.ethers.getContractAt("UserProfile", cfg.userProfile);
  await (await up.setPlatformContract(newFE, true)).wait();
  await (await up.setPlatformContract(cfg.oldFE, false)).wait();
  await (await up.setPlatformContract(newDG, true)).wait();
  await (await up.setPlatformContract(cfg.oldDG, false)).wait();

  console.log("[9/10] Readback gate (FreelancerEscrow)...");
  const feChecks = {
    treasury: (await fe.treasury()) === TREASURY,
    userProfile: (await fe.userProfile()) === cfg.userProfile,
    feeDistributor: (await fe.feeDistributor()) === cfg.feeDistributor,
    usdcAllowed: (await fe.allowedTokens(cfg.mockUSDC)) === true,
    hookNewFE: (await up.platformContracts(newFE)) === true,
    hookOldFE: (await up.platformContracts(cfg.oldFE)) === false,
  };
  console.log("  ", JSON.stringify(feChecks));
  if (Object.values(feChecks).some(v => !v)) throw new Error("FE READBACK FAILED");

  console.log("[10/10] Readback gate (DigitalGoods)...");
  const dgChecks = {
    treasury: (await dg.treasury()) === TREASURY,
    userProfile: (await dg.userProfile()) === cfg.userProfile,
    usdcAllowed: (await dg.allowedTokens(cfg.mockUSDC)) === true,
    hookNewDG: (await up.platformContracts(newDG)) === true,
    hookOldDG: (await up.platformContracts(cfg.oldDG)) === false,
  };
  console.log("  ", JSON.stringify(dgChecks));
  if (Object.values(dgChecks).some(v => !v)) throw new Error("DG READBACK FAILED");

  console.log("\nDONE —", cfg.name);
  console.log("  freelancerEscrow:", newFE);
  console.log("  digitalGoods    :", newDG);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
