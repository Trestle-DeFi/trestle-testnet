# Trestle DeFi — Smart Contracts

Hardhat project with Solidity smart contracts for the Trestle DeFi Marketplace.

## Contracts

| Contract | Description | Security |
|----------|-------------|----------|
| `DigitalRWA.sol` | RWA tokenization — Chainlink price feed, USDC-gated whitelist, mint/subscribe | nonReentrant, custom errors, zero-address guards |
| `DigitalGoods.sol` | Marketplace — fixed-price + Dutch auction, delivery flow, dispute resolution | Custom errors, zero-address validation |
| `FreelancerEscrow.sol` | Freelance escrow — fixed/Dutch budget, milestones, gig marketplace, auto-approve | nonReentrant on all state-changing functions, custom errors |
| `FeeDistributor.sol` | 40/40/20 fee split (treasury/yield/buyback-burn), ETH + ERC20 | Custom errors |
| `UserProfile.sol` | On-chain profiles + token-gated reviews with cooldown | Custom errors, zero-address guard |
| `MockGovernanceToken.sol` | ERC-20 governance token (tGOV) for whitelisting | Used by DigitalRWA |
| `MockERC20.sol` | Generic mock ERC-20 for testing (USDC, USDT, xNOBT, xBRT) | — |

## Deployed — Base Sepolia (84532) — All verified (2026-09-24 redeploy; DigitalGoods + FreelancerEscrow re-redeployed 2026-10-21: bug-batch fixes)
> FreEscrow/DGoods history: `0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D` → `0x756CF434FAB30A18117810B9dC3a8f7F68e891DB` (2026-10-16) → current below

| Contract | Address | Explorer |
|----------|---------|----------|
| MockGovernanceToken | `0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914` | [View](https://sepolia.basescan.org/address/0xc550F40566C2aFEe6980aC3d64b9B3A2A0B8b914#code) |
| FeeDistributor | `0xcc5f9C02cD093002cE3921180e32f76cE03F01C0` | [View](https://sepolia.basescan.org/address/0xcc5f9C02cD093002cE3921180e32f76cE03F01C0#code) |
| DigitalGoods | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` | [View](https://sepolia.basescan.org/address/0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952#code) |
| FreelancerEscrow | `0xBD551EE22321B500AB171885eb77574943aB65E1` | [View](https://sepolia.basescan.org/address/0xBD551EE22321B500AB171885eb77574943aB65E1#code) |
| DigitalRWA | `0x5582496273a71E60e457D19773050CC848A2F52C` | [View](https://sepolia.basescan.org/address/0x5582496273a71E60e457D19773050CC848A2F52C#code) |
| UserProfile | `0xa1889d658601c7fA649a70516341fF4aac761ca8` | [View](https://sepolia.basescan.org/address/0xa1889d658601c7fA649a70516341fF4aac761ca8#code) |
| Mock USDC | `0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E` | [View](https://sepolia.basescan.org/address/0x6A3d2890f93e67BB20c826DA9536AD863584Cd5E#code) |

> Note: the first FreelancerEscrow from the 2026-09-24 run (`0xAe105cB5039Ffd52eCBA7D0089E54Bf16b49E7D5`) was replaced by `0x301C0CD3...` (its deploy-time compiler artifacts were unrecoverable, so it could not be source-verified; it held no state).

**RWA pricing:** Chainlink testnet feed proxies are deprecated (Shutdown Policy); price set via admin `setManualPrice()` ($3000 ETH/USD). `syncPrice()` remains primary if a live feed returns.

## Deployed — Arbitrum Sepolia (421614) — All verified (2026-09-24 redeploy; DigitalGoods + FreelancerEscrow re-redeployed 2026-10-21: bug-batch fixes)

| Contract | Address | Explorer |
|----------|---------|----------|
| MockGovernanceToken | `0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D` | [View](https://sepolia.arbiscan.io/address/0x2Ad9fFCBC6453B2b7A458bD80747c202F188606D#code) |
| FeeDistributor | `0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71` | [View](https://sepolia.arbiscan.io/address/0xD63A90d82Fc8c74FbBbE3d9b0516d79985Fe0d71#code) |
| DigitalGoods | `0xa9E7f0762EEC2902cC44577D8F799743A62171c8` | [View](https://sepolia.arbiscan.io/address/0xa9E7f0762EEC2902cC44577D8F799743A62171c8#code) |
| FreelancerEscrow | `0xBeb83e3d78772c3DC32142c590eac8cB39A0aaCA` | [View](https://sepolia.arbiscan.io/address/0xBeb83e3d78772c3DC32142c590eac8cB39A0aaCA#code) |
| DigitalRWA | `0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D` | [View](https://sepolia.arbiscan.io/address/0x4eC3777B16FC7Da556B451679A10A8fDFC5Fd48D#code) |
| UserProfile | `0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D` | [View](https://sepolia.arbiscan.io/address/0xA8fb99180AdfFD8d0986A32f472faD2A17B57D7D#code) |
| Mock USDC | `0xC36C239D0b3144015178727f939e0766Bf71D816` | [View](https://sepolia.arbiscan.io/address/0xC36C239D0b3144015178727f939e0766Bf71D816#code) |

**RWA pricing:** manual `setManualPrice()` fallback ($3000 ETH/USD) — no classic Chainlink feeds remain on this testnet.

## Deployed — Polygon Amoy (80002) — All verified (2026-09-25; DigitalGoods + FreelancerEscrow re-redeployed 2026-10-21: bug-batch fixes)

| Contract | Address | Explorer |
|----------|---------|----------|
| MockGovernanceToken | `0x7f411bA9824513a95C591A061F97A0A375B2cB71` | [View](https://amoy.polygonscan.com/address/0x7f411bA9824513a95C591A061F97A0A375B2cB71#code) |
| FeeDistributor | `0x4104eA3D55F9C2F5818671e5365F801996D83038` | [View](https://amoy.polygonscan.com/address/0x4104eA3D55F9C2F5818671e5365F801996D83038#code) |
| DigitalGoods | `0x8c99Df55d6fb332eb0B88DE0ba580b9EC3dB28Fb` | [View](https://amoy.polygonscan.com/address/0x8c99Df55d6fb332eb0B88DE0ba580b9EC3dB28Fb#code) |
| FreelancerEscrow | `0xc710f53C77698172D43b02cEa72d18B920dE5F9c` | [View](https://amoy.polygonscan.com/address/0xc710f53C77698172D43b02cEa72d18B920dE5F9c#code) |
| DigitalRWA | `0x7f750E8BD9c9C2685710A03De5307961BC50aF31` | [View](https://amoy.polygonscan.com/address/0x7f750E8BD9c9C2685710A03De5307961BC50aF31#code) |
| UserProfile | `0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952` | [View](https://amoy.polygonscan.com/address/0xdAe47049b5f1D1557a6f3C19Ad17a4C473f91952#code) |
| Mock USDC | `0xBD551EE22321B500AB171885eb77574943aB65E1` | [View](https://amoy.polygonscan.com/address/0xBD551EE22321B500AB171885eb77574943aB65E1#code) |

**RWA pricing:** manual `setManualPrice()` fallback ($0.20 POL/USD) — Amoy ETH/USD feed is sunset (contract exists at `0x001382149eBa3441043c1c66972b4772963f5D43` but reverts on all calls; `syncPrice()` unusable, so `subscribe()` native payments are also blocked — see known limitation below).

## Supported Networks

| Network | Chain ID | Native | RPC | Status |
|---------|----------|--------|-----|--------|
| Polygon Amoy | 80002 | POL | `https://polygon-amoy-bor-rpc.publicnode.com` | Deployed |
| Base Sepolia | 84532 | ETH | `https://sepolia.base.org` | Deployed |
| Arbitrum Sepolia | 421614 | ETH | `https://sepolia-rollup.arbitrum.io/rpc` | Deployed |
| Polygon PoS | 137 | POL | `https://polygon-rpc.com/` | Configured |
| Base Mainnet | 8453 | ETH | `https://mainnet.base.org` | Configured |
| Arbitrum One | 42161 | ETH | `https://arb1.arbitrum.io/rpc` | Configured |

## Setup

```bash
npm install
cp .env.example .env   # add PRIVATE_KEY, RPC URLs, ETHERSCAN_API_KEY
npx hardhat compile
npx hardhat test
```

## Deploy

Deployment follows a resumable pipeline strategy (health-checked dual RPC endpoints, per-chain checkpointing). RWA-only redeployments: `scripts/redeploy-rwa.js` (deploy + whitelist + oracle-first/manual-price + auto-verify).

```bash
# Deploy to Base Sepolia
npx hardhat run scripts/deploy_all.js --network baseSepolia

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/deploy_all.js --network arbitrumSepolia

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy_all.js --network amoy

# Deploy to Base Mainnet
npx hardhat run scripts/deploy_all.js --network base
```

The deploy script auto-detects chain ID and selects the correct:
- Native token symbol (ETH / POL)
- Chainlink ETH/USD price feed address
- Block explorer for verification

## Security

- `nonReentrant` on every external function that makes external calls; pure-storage creation/listing functions (`listFixed`, `listDutch`, `createProject*`, `createGig`, `updateGig`, `cancelGig`) don't need it and don't carry it
- Custom errors instead of require strings (gas-efficient)
- Zero-address validation in constructors
- Access control via `Ownable` + `AccessControl` roles
- Pausable contracts (DigitalRWA)
- Token-gated whitelist (DigitalRWA — requires USDC balance, swappable via `setWhitelistToken()`, capped at `MAX_WHITELIST_TOKENS`)
- Oracle: dynamic feed decimals in `subscribe()`, staleness checks, and a ≤20% per-sync price-deviation guard
- Audited 2026-09-18 — 15 findings fixed with regression tests in the Hardhat suite

## Architecture

```
contracts/
├── src/
│   ├── DigitalRWA.sol          # RWA tokenization + Chainlink oracle
│   ├── DigitalGoods.sol        # Marketplace (fixed + Dutch auction)
│   ├── FreelancerEscrow.sol    # Freelance escrow + gig marketplace
│   ├── FeeDistributor.sol      # 40/40/20 fee split
│   ├── UserProfile.sol         # On-chain profiles + reviews
│   └── mocks/
│       ├── MockGovernanceToken.sol
│       ├── MockERC20.sol
│       └── MockV3Aggregator.sol
├── scripts/
│   ├── deploy_all.js            # Full suite deploy + hook wiring + post-deploy config (canonical)
│   ├── deploy.js                # Full deploy with mock stablecoins (legacy)
│   ├── configure_deployed.js    # Post-deploy config for existing deployments (allowlist/FD link/price)
│   ├── redeploy_fe.js           # One-off: replace unverifiable FreelancerEscrow (Base 2026-09-24)
│   ├── resume_deploy_amoy.js    # Resume partial Amoy deploy_all run
│   ├── redeploy-rwa.js         # RWA-only redeploy + config + verify
│   ├── verify_live.js          # On-chain live-config checks
│   └── e2e_amoy.js             # Amoy end-to-end flow
├── test/
│   ├── Heavy.test.js           # 94 security-focused tests
│   ├── TrestleProtocol.test.js # 38 integration tests
│   └── Yield.test.js           # 5 ERC-4626 yield tests
└── hardhat.config.js           # Multi-network config
```
