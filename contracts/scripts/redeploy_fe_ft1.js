const hre = require("hardhat");

// F-T1 redeploy (TRESTLE-FT1-COARSE-20261009): replace FreelancerEscrow with
// the coarse-share fix (deposit MIN_SHARE_RATE guard + bumped-redemption
// surplus held, not booked as yield). Replicates the live wiring read from
// chain (same shape as redeploy_fe_h1.js): treasury 0x64A7.., USDC allowed,
// FeeDistributor linked, UserProfile platform hook re-pointed (new=true,
// old=false). "oldFE" here is the ZAFRAN-H1 FreelancerEscrow.
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";

const CHAINS = {
  84532: {
    name: "Base Sepolia",
    userProfile: "0xa1889d658601c7fA649a70516341fF4aac761ca8",
    oldFE: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
  },
  421614: {
    name: "Arbitrum Sepolia",
    userProfile: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    oldFE: "0xFd919cE133d356bdeb0577e6b35b20b7caD69722",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
  },
  80002: {
    name: "Polygon Amoy",
    userProfile: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    oldFE: "0x05f6B7e45833A4Cb9f934dB4116993b6c2522546",
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

  console.log("[1/6] Deploying FreelancerEscrow (F-T1 fix)...");
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
    hookNew: (await up.platformContracts(newFE)) === true,
    hookOld: (await up.platformContracts(cfg.oldFE)) === false,
  };
  console.log(" ", JSON.stringify(checks, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  if (Object.values(checks).some(v => !v)) throw new Error("READBACK FAILED");

  console.log("\nDONE —", cfg.name);
  console.log("  freelancerEscrow:", newFE);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
