const hre = require("hardhat");

// Testnet contract addresses (source: frontend/src/config/contracts.ts)
const CONTRACT_ADDRESSES = {
  amoy: {
    userProfile: "0x539ba8F7905524c2e9d844890693C4d723B6731B",
    digitalGoods: "0x904B176AbDb890efCE94A900ec58ac6ba5542ddE",
    freelancerEscrow: "0x797C5F47C08779bacA98F6f98E9148b4bb0c1FCb",
  },
  baseSepolia: {
    userProfile: "0x0bd00b1134bad04117e14c36D1055Ce6c1d8570D",
    digitalGoods: "0x975C9fFA819f6057d9515CC17c93bcE52BCA8BED",
    freelancerEscrow: "0x50a354b985b6c68C8f2288a28354b9885E01C4F5",
  },
  arbitrumSepolia: {
    userProfile: "0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6",
    digitalGoods: "0xD0535723f2E33A8d6d05FDA33Ea85cDbCaea8EF5",
    freelancerEscrow: "0x7D31806d5AD7deB103bf42156bBfd371dA409192",
  },
};

async function main() {
  require("dotenv").config();

  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("PRIVATE_KEY not found in .env");
    process.exit(1);
  }

  const { ethers } = hre;
  const wallet = new ethers.Wallet(privateKey, ethers.provider);
  const networkName = hre.network.name;

  console.log("Using account:", wallet.address);
  console.log("Network:", networkName);

  if (!CONTRACT_ADDRESSES[networkName]) {
    console.error(`No contract addresses configured for network: ${networkName}`);
    console.error("Supported networks: ${Object.keys(CONTRACT_ADDRESSES).join(', ')}");
    process.exit(1);
  }

  const addresses = CONTRACT_ADDRESSES[networkName];
  const userProfile = await hre.ethers.getContractAt("UserProfile", addresses.userProfile);
  const digitalGoods = await hre.ethers.getContractAt("DigitalGoods", addresses.digitalGoods);
  const freelancerEscrow = await hre.ethers.getContractAt("FreelancerEscrow", addresses.freelancerEscrow);

  console.log(`\nRegistering platform contracts on ${networkName}...`);

  // Register DigitalGoods as platform
  console.log("\nRegistering DigitalGoods as platform...");
  const tx1 = await userProfile.setPlatformContract(addresses.digitalGoods, true);
  await tx1.wait();
  console.log("✅ DigitalGoods registered (txid:", tx1.hash, ")");

  // Register FreelancerEscrow as platform
  console.log("\nRegistering FreelancerEscrow as platform...");
  const tx2 = await userProfile.setPlatformContract(addresses.freelancerEscrow, true);
  await tx2.wait();
  console.log("✅ FreelancerEscrow registered (txid:", tx2.hash, ")");

  // Verify
  const dp = await userProfile.platformContracts(addresses.digitalGoods);
  const fp = await userProfile.platformContracts(addresses.freelancerEscrow);

  console.log(`\n✅ All platform contracts registered on ${networkName}!`);
  console.log(`  DigitalGoods platform: ${dp.toString()}`);
  console.log(`  FreelancerEscrow platform: ${fp.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
