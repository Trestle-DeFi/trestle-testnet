const hre = require("hardhat");

// One-off: replace FreelancerEscrow on Base Sepolia.
// The original deploy tx (0x891aa985...) produced bytecode that could not be
// reproduced or verified on Basescan (deploy-era build-info was destroyed by
// `hardhat clean`), so the contract is redeployed from current artifacts and
// the UserProfile hooks are re-pointed.
const CHAIN_ID = 84532;
const TREASURY = "0x64A7ef92229D2D97d1C4fd3DB15Db2d94d3D66F6";
const USER_PROFILE = "0xa1889d658601c7fA649a70516341fF4aac761ca8";
const OLD_FE = "0xAe105cB5039Ffd52eCBA7D0089E54Bf16b49E7D5";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (chainId !== CHAIN_ID) {
    throw new Error(`Expected chainId ${CHAIN_ID}, got ${chainId}`);
  }

  console.log("Deployer:", deployer.address);

  const FreelancerEscrow = await hre.ethers.getContractFactory("FreelancerEscrow");
  const fe = await FreelancerEscrow.deploy(TREASURY);
  await fe.waitForDeployment();
  const newFE = await fe.getAddress();
  console.log("New FreelancerEscrow:", newFE);

  const userProfile = await hre.ethers.getContractAt("UserProfile", USER_PROFILE);
  console.log("Re-pointing UserProfile platform hook -> new FE...");
  await (await userProfile.setPlatformContract(newFE, true)).wait();
  await (await userProfile.setPlatformContract(OLD_FE, false)).wait();
  console.log("Disabling old FE:", OLD_FE);

  console.log("Wiring new FE -> UserProfile...");
  await (await fe.setUserProfile(USER_PROFILE)).wait();

  console.log("\nDONE");
  console.log("  freelancerEscrow:", newFE);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
