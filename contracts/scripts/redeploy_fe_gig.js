const hre = require("hardhat");

// Gig-deadline redeploy (TRESTLE-GIG-DEADLINE-20261015): replace FreelancerEscrow
// with the MAX_MILESTONE_HORIZON fix so createGig/updateGig (which pass
// _durationDays == 0) can no longer accept unbounded milestone deadlines.
// Replicates the live wiring read from chain (same shape as redeploy_fe_ft1.js):
// treasury 0x64A7.., USDC allowed, FeeDistributor linked, UserProfile platform
// hook re-pointed (new=true, old=false). "oldFE" here is the current live
// F-T1 FreelancerEscrow (the one being retired).
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
const MAX_MILESTONE_HORIZON = 365n * 24n * 60n * 60n; // 31,536,000

const CHAINS = {
  84532: {
    name: "Base Sepolia",
    userProfile: "0xa1889d658601c7fA649a70516341fF4aac761ca8",
    oldFE: "0x2Da8486d0bC8E44E23eF02a3760745FC0b57B5E2",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
  },
  421614: {
    name: "Arbitrum Sepolia",
    userProfile: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    oldFE: "0x18F01543d6D1AF6f80E8624f17bc73666e43525e",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
  },
  80002: {
    name: "Polygon Amoy",
    userProfile: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    oldFE: "0x33226359935b5922F834355ced7D49A66825f92C",
    feeDistributor: "0x4104eA3D55F9C2F5818671e5365F801996D83038",
    mockUSDC: "0xBD551EE22321B500AB171885eb77574943aB65E1",
  },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`No config for chainId ${chainId}`);

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", cfg.name, "| Deployer:", deployer.address, "| Balance:", hre.ethers.formatEther(bal));
  if (bal < hre.ethers.parseEther("0.002")) throw new Error("Deployer balance too low, aborting");

  console.log("[1/6] Deploying FreelancerEscrow (Gig-deadline fix)...");
  const FreelancerEscrow = await hre.ethers.getContractFactory("FreelancerEscrow");
  const fe = await FreelancerEscrow.deploy(TREASURY);
  await fe.waitForDeployment();
  const newFE = await fe.getAddress();
  console.log("  ->", newFE);

  console.log("[2/6] setUserProfile...");
  await (await fe.setUserProfile(cfg.userProfile)).wait();
  console.log("[3/6] setTokenAllowed(USDC)...");
  await (await fe.setTokenAllowed(cfg.mockUSDC, true)).wait();
  console.log("[4/6] setFeeDistributor...");
  await (await fe.setFeeDistributor(cfg.feeDistributor)).wait();

  console.log("[5/6] Re-pointing UserProfile hooks...");
  const up = await hre.ethers.getContractAt("UserProfile", cfg.userProfile);
  await (await up.setPlatformContract(newFE, true)).wait();
  await (await up.setPlatformContract(cfg.oldFE, false)).wait();

  console.log("[6/6] Readback verification...");
  const checks = {
    treasury: (await fe.treasury()) === TREASURY,
    userProfile: (await fe.userProfile()) === cfg.userProfile,
    feeDistributor: (await fe.feeDistributor()) === cfg.feeDistributor,
    usdcAllowed: (await fe.allowedTokens(cfg.mockUSDC)) === true,
    minShareRate: (await fe.MIN_SHARE_RATE()) === 1000000000000000n,
    maxMilestoneHorizon: (await fe.MAX_MILESTONE_HORIZON()) === MAX_MILESTONE_HORIZON,
    hookNew: (await up.platformContracts(newFE)) === true,
    hookOld: (await up.platformContracts(cfg.oldFE)) === false,
  };
  console.log(" ", JSON.stringify(checks, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  if (Object.values(checks).some(v => !v)) throw new Error("READBACK FAILED");

  console.log("\nDONE —", cfg.name);
  console.log("  freelancerEscrow:", newFE);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
