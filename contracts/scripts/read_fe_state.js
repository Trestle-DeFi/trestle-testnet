const hre = require("hardhat");

const CHAINS = {
  84532: { name: "Base Sepolia", fe: "0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B", usdc: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E", up: "0xa1889d658601c7fA649a70516341fF4aac761ca8" },
  421614: { name: "Arbitrum Sepolia", fe: "0x58E3B6f2eFD7F3ee4afe98A754e155DBE9052513", usdc: "0xC36C239D0b3144015178727f939e0766Bf71D816", up: "0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D" },
  80002: { name: "Polygon Amoy", fe: "0x7007DC17282316676c5d1Eb085D3CeC993f92193", usdc: "0xBD551EE22321B500AB171885eb77574943aB65E1", up: "0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952" },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`No config for ${chainId}`);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", cfg.name);
  console.log("Deployer:", deployer.address, "balance:", hre.ethers.formatEther(bal));

  const fe = await hre.ethers.getContractAt("FreelancerEscrow", cfg.fe);
  console.log("FE.treasury:", await fe.treasury());
  console.log("FE.userProfile:", await fe.userProfile());
  console.log("FE.feeDistributor:", await fe.feeDistributor());
  console.log("FE.yieldVault:", await fe.yieldVault());
  console.log("FE.allowedTokens[USDC]:", await fe.allowedTokens(cfg.usdc));
  console.log("FE.projectsWithShares:", (await fe.projectsWithShares()).toString());
  try {
    console.log("FE.totalEscrowed(native):", hre.ethers.formatEther(await fe.totalEscrowed("0x0000000000000000000000000000000000000000")));
  } catch (e) { console.log("totalEscrowed read failed:", e.message.slice(0, 80)); }

  const up = await hre.ethers.getContractAt("UserProfile", cfg.up);
  console.log("UP.platformContracts[oldFE]:", await up.platformContracts(cfg.fe));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
