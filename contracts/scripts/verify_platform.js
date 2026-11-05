const hre = require('hardhat');

async function main() {
  const network = hre.network.name;
  const addresses = {
    amoy: {
      userProfile: '0x539ba8F7905524c2e9d844890693C4d723B6731B',
      digitalGoods: '0x904B176AbDb890efCE94A900ec58ac6ba5542ddE',
      freelancerEscrow: '0x797C5F47C08779bacA98F6f98E9148b4bb0c1FCb'
    },
    baseSepolia: {
      userProfile: '0x0bd00b1134bad04117e14c36D1055Ce6c1d8570D',
      digitalGoods: '0x975C9fFA819f6057d9515CC17c93bcE52BCA8BED',
      freelancerEscrow: '0x50a354b985b6c68C8f2288a28354b9885E01C4F5'
    },
    arbitrumSepolia: {
      userProfile: '0x29A11Daa0a43c3eE433E17bB3bd4d5dEABa1DBd6',
      digitalGoods: '0xD0535723f2E33A8d6d05FDA33Ea85cDbCaea8EF5',
      freelancerEscrow: '0x7D31806d5AD7deB103bf42156bBfd371dA409192'
    }
  }[network];
  
  if (!addresses) {
    console.log(`Unknown network: ${network}`);
    return;
  }
  
  const userProfile = await hre.ethers.getContractAt('UserProfile', addresses.userProfile);
  const digitalGoods = await hre.ethers.getContractAt('DigitalGoods', addresses.digitalGoods);
  const freelancerEscrow = await hre.ethers.getContractAt('FreelancerEscrow', addresses.freelancerEscrow);
  
  console.log(`${network} Platform Status:`);
  console.log(`  DigitalGoods platform: ${await userProfile.platformContracts(digitalGoods.address)}`);
  console.log(`  FreelancerEscrow platform: ${await userProfile.platformContracts(freelancerEscrow.address)}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
