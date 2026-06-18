import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { CHAIN_CONFIG } from "../config/contracts";

const SUPPORTED = [CHAIN_CONFIG.amoy.id, CHAIN_CONFIG.polygon.id] as const;

const ERC20_ABI = [
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

export function useContracts() {
  const { address, isConnected, chain } = useAccount();
  const chainId = chain?.id ?? CHAIN_CONFIG.amoy.id;
  const { data: native } = useBalance({ address });

  const isCorrectChain = (SUPPORTED as readonly number[]).includes(chainId);
  const chainName = chainId === CHAIN_CONFIG.polygon.id
    ? CHAIN_CONFIG.polygon.name
    : chainId === CHAIN_CONFIG.amoy.id
      ? CHAIN_CONFIG.amoy.name
      : "Unsupported";

  const hNOBT = "0xcF51ab7398315DbA6588Aa7fb3Df7c99D3D1F4dD" as Address;
  const brt = "0xeCb4cAc0C9e5cBd42a9Ed36467ce8f96072AD58b" as Address;

  const { data: hNOBTBal } = useReadContract({ abi: ERC20_ABI, address: hNOBT, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: brtBal } = useReadContract({ abi: ERC20_ABI, address: brt, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });

  return {
    address,
    isConnected,
    isCorrectChain,
    chainName,
    balance: native ? formatUnits(native.value, native.decimals) : "0",
    hNOBTBalance: hNOBTBal?.toString() ?? "0",
    brtBalance: brtBal?.toString() ?? "0",
  };
}
