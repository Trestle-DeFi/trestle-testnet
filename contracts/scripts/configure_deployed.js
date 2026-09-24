const hre = require("hardhat");

// Post-deploy configuration that deploy_all.js omits (deploy.js does this).
// - DigitalGoods / FreelancerEscrow: allow MockUSDC for token payments
// - FreelancerEscrow: link FeeDistributor (otherwise yield fees bypass the split)
// - DigitalRWA: syncPrice() with fallback to admin setManualPrice() (deprecated feeds)
const CHAINS = {
  84532: {
    name: "Base Sepolia",
    digitalGoods: "0x89f5394a468343F405285040664Fd77843D2a2e6",
    freelancerEscrow: "0x301C0CD35e76Ae3956f6410b46D2aD0E3f60Bd5B",
    digitalRWA: "0x5582496273a71E60e457D19773050CC848A2F52C",
    feeDistributor: "0xcc5f9C02cD093002cE3921180e32f76cE03F01C0",
    mockUSDC: "0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E",
    manualPrice: 300000000000n, // $3000 ETH/USD (8 decimals)
  },
  421614: {
    name: "Arbitrum Sepolia",
    digitalGoods: "0x6D6C679279f5C680e5a6ef33306F2e9A78577DCa",
    freelancerEscrow: "0x58E3B6f2eFD7F3ee4afe98A754e155DBE9052513",
    digitalRWA: "0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D",
    feeDistributor: "0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71",
    mockUSDC: "0xC36C239D0b3144015178727f939e0766Bf71D816",
    manualPrice: 300000000000n, // $3000 ETH/USD (8 decimals)
  },
};

async function main() {
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`No configuration for chainId ${chainId}`);
  console.log("Configuring:", cfg.name);

  const dg = await hre.ethers.getContractAt("DigitalGoods", cfg.digitalGoods);
  await (await dg.setTokenAllowed(cfg.mockUSDC, true)).wait();
  console.log("  DigitalGoods: USDC allowed");

  const fe = await hre.ethers.getContractAt("FreelancerEscrow", cfg.freelancerEscrow);
  await (await fe.setTokenAllowed(cfg.mockUSDC, true)).wait();
  console.log("  FreelancerEscrow: USDC allowed");
  await (await fe.setFeeDistributor(cfg.feeDistributor)).wait();
  console.log("  FreelancerEscrow: linked to FeeDistributor");

  const rwa = await hre.ethers.getContractAt("DigitalRWA", cfg.digitalRWA);
  try {
    await (await rwa.syncPrice()).wait();
    const synced = await rwa.currentPrice();
    if (synced > 0n) {
      console.log("  DigitalRWA: price synced =", hre.ethers.formatUnits(synced, 8));
    } else {
      throw new Error("feed returned 0");
    }
  } catch (e) {
    console.log("  DigitalRWA: syncPrice failed (" + String(e.message).slice(0, 60) + ") — falling back to manual price");
    await (await rwa.setManualPrice(cfg.manualPrice)).wait();
    console.log("  DigitalRWA: manual price set =", hre.ethers.formatUnits(await rwa.currentPrice(), 8));
  }

  console.log("\nDONE —", cfg.name);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
