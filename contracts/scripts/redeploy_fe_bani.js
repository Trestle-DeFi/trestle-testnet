const hre = require("hardhat");

// BANI-FOT redeploy (2026-10-25): FreelancerEscrow ONLY.
// Fixes the fee-on-transfer funding insolvency/deadlock (BANI-FOT):
//   - fundProjectWithToken now measures received tokens, reverts with
//     InsufficientReceived below the budget, and refunds only the net surplus.
// Mirrors the DigitalGoods TRST-03 fix already shipped in buyWithToken.
// DigitalGoods is NOT touched by this run.
// Wiring replicates redeploy_bugbatch.js (current live shape).
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";

const CHAINS = {
  84532: {
    name: "Base Sepolia",
    userProfile: "0xa1889d658601c7fA649a70516341fF4aac761ca8",
    oldFE: "0x756CF434FAB30A18117810B9dC3a8f7F68e891DB",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
  },
  421614: {
    name: "Arbitrum Sepolia",
    userProfile: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    oldFE: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
  },
  80002: {
    name: "Polygon Amoy",
    userProfile: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    oldFE: "0xD0de38492b5f5F2D3979DdD798CCE95395140C53",
    feeDistributor: "0x4104eA3D55F9C2F5818671e5365F801996D83038",
    mockUSDC: "0xBD551EE22321B500AB171885eb77574943aB65E1",
  },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`No config for chainId ${chainId}`);

  // Health/balance gate
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", cfg.name, "| Deployer:", deployer.address, "| Balance:", hre.ethers.formatEther(bal));
  if (bal < hre.ethers.parseEther("0.01")) throw new Error("Deployer balance too low, aborting");

  // [1] FreelancerEscrow
  console.log("[1/6] Deploying FreelancerEscrow (BANI-FOT fix)...");
  const FreelancerEscrow = await hre.ethers.getContractFactory("FreelancerEscrow");
  const fe = await FreelancerEscrow.deploy(TREASURY);
  await fe.waitForDeployment();
  const newFE = await fe.getAddress();
  console.log("  ->", newFE);

  // [2] FE.setUserProfile
  console.log("[2/6] FE.setUserProfile...");
  await (await fe.setUserProfile(cfg.userProfile)).wait();

  // [3] FE.setTokenAllowed(USDC)
  console.log("[3/6] FE.setTokenAllowed(USDC)...");
  await (await fe.setTokenAllowed(cfg.mockUSDC, true)).wait();

  // [4] FE.setFeeDistributor
  console.log("[4/6] FE.setFeeDistributor...");
  await (await fe.setFeeDistributor(cfg.feeDistributor)).wait();

  // [5] Re-point UserProfile hooks (new on, old off)
  console.log("[5/6] Re-pointing UserProfile hooks...");
  const up = await hre.ethers.getContractAt("UserProfile", cfg.userProfile);
  await (await up.setPlatformContract(newFE, true)).wait();
  await (await up.setPlatformContract(cfg.oldFE, false)).wait();

  // [6] Readback gate
  console.log("[6/6] Readback gate (FreelancerEscrow)...");
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

  // Verify on explorer (non-hardhat)
  if (hre.network.name !== "hardhat") {
    console.log("\nVerifying FreelancerEscrow...");
    await verify("FreelancerEscrow", newFE, [TREASURY]);
  }

  console.log("\nDONE —", cfg.name);
  console.log("  freelancerEscrow:", newFE);
}

async function verify(name, address, args) {
  console.log(`  ${name}...`);
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log("  ✓ Verified");
  } catch (e) {
    console.log("  ✗", e.message.slice(0, 120));
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });