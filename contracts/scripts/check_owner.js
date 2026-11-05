/**
 * Check UserProfile owner on each testnet
 * Usage: npx hardhat run scripts/check_owner.js --network <network>
 */
const { ethers } = require("hardhat");

// UserProfile addresses per network
const ADDRESSES = {
  amoy: "0xdd89E04e5bB9B79775A87Fa9666C5Fe03a01e169",
  baseSepolia: "0xdd89E04e5bB9B79775A87Fa9666C5Fe03a01e169",
  arbitrumSepolia: "0xdd89E04e5bB9B79775A87Fa9666C5Fe03a01e169"
};

async function main() {
  const networkName = hre.network.name;
  const address = ADDRESSES[networkName];

  if (!address) {
    console.log(`No address configured for ${networkName}`);
    return;
  }

  console.log(`\n=== ${networkName.toUpperCase()} ===`);
  console.log(`UserProfile: ${address}`);

  const UserProfile = await ethers.getContractFactory("UserProfile");
  const up = await UserProfile.attach(address);
  const owner = await up.owner();
  const envKey = process.env.PRIVATE_KEY?.slice(0, 10) || "not set";

  console.log(`Owner: ${owner}`);
  console.log(` .env key prefix: ${envKey}`);

  if (owner && owner.toLowerCase().includes(envKey?.toLowerCase() || "")) {
    console.log(`*** .env key IS the Owner ***`);
  } else if (owner) {
    console.log(`*** .env key is NOT the Owner ***`);
    console.log(`Owner: ${owner.slice(0, 10)}...`);
  }

  if (owner === "0x0000000000000000000000000000000000000000") {
    console.log(`*** Ownership renounced ***`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });