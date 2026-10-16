const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Live verification: the gig-deadline FreelancerEscrow bytecode matches the
// fixed local artifact, wiring is correct, old hook disabled, MIN_SHARE_RATE
// and MAX_MILESTONE_HORIZON exposed.
const MAX_MILESTONE_HORIZON = 365n * 24n * 60n * 60n; // 31,536,000
const CHAINS = {
  84532: {
    name: "Base Sepolia",
    newFE: "0x756CF434FAB30A18117810B9dC3a8f7F68e891DB",
    oldFE: "0x2Da8486d0bC8E44E23eF02a3760745FC0b57B5E2",
    up: "0xa1889d658601c7fA649a70516341fF4aac761ca8",
    fd: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    usdc: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
  },
  421614: {
    name: "Arbitrum Sepolia",
    newFE: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    oldFE: "0x18F01543d6D1AF6f80E8624f17bc73666e43525e",
    up: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D",
    fd: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    usdc: "0xC36C239D0b3144015178727f939e0766Bf71D816",
  },
  80002: {
    name: "Polygon Amoy",
    newFE: "0xD0de38492b5f5F2D3979DdD798CCE95395140C53",
    oldFE: "0x33226359935b5922F834355ced7D49A66825f92C",
    up: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952",
    fd: "0x4104eA3D55F9C2F5818671e5365F801996D83038",
    usdc: "0xBD551EE22321B500AB171885eb77574943aB65E1",
  },
};
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";

async function main() {
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`No config for ${chainId}`);
  console.log("Live check:", cfg.name);

  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/src/FreelancerEscrow.sol/FreelancerEscrow.json"), "utf8"));
  const onchain = await hre.ethers.provider.getCode(cfg.newFE);
  const localHash = hre.ethers.keccak256(artifact.deployedBytecode);
  const chainHash = hre.ethers.keccak256(onchain);
  console.log("  code present:", onchain !== "0x");
  console.log("  bytecode match:", localHash === chainHash);

  const fe = await hre.ethers.getContractAt("FreelancerEscrow", cfg.newFE);
  const up = await hre.ethers.getContractAt("UserProfile", cfg.up);
  const checks = {
    treasury: (await fe.treasury()) === TREASURY,
    userProfile: (await fe.userProfile()) === cfg.up,
    feeDistributor: (await fe.feeDistributor()) === cfg.fd,
    usdcAllowed: (await fe.allowedTokens(cfg.usdc)) === true,
    minShareRate: (await fe.MIN_SHARE_RATE()) === 1000000000000000n,
    maxMilestoneHorizon: (await fe.MAX_MILESTONE_HORIZON()) === MAX_MILESTONE_HORIZON,
    hookNew: (await up.platformContracts(cfg.newFE)) === true,
    hookOld: (await up.platformContracts(cfg.oldFE)) === false,
  };
  console.log(" ", JSON.stringify(checks));
  if (localHash !== chainHash || Object.values(checks).some(v => !v)) throw new Error("LIVE CHECK FAILED");
  console.log("ALL GOOD —", cfg.name);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
