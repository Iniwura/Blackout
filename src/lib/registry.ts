// blackout/lib/registry.ts
// Reads the wrappers registry and enriches each pair with the metadata a UI
// actually needs: symbol, name, decimals, rate, mintability, user balances.

import type { Address } from "viem";
import { REGISTRY_ADDRESS, MOCK_UNDERLYINGS, RESTRICTED_UNDERLYINGS } from "./config";
import { REGISTRY_ABI, ERC20_ABI, WRAPPER_ABI } from "./abi";
import { publicClient } from "./clients";

/**
 * Full information for a wrapper pair — enough to render a row without
 * additional lookups. `balance` fields are cleartext for the underlying
 * ERC-20 (public onchain) and a ciphertext handle for the wrapper (needs
 * userDecrypt to reveal).
 */
export interface PairInfo {
  underlying: Address;
  wrapper: Address;
  isValid: boolean;
  underlyingSymbol: string;
  underlyingName: string;
  underlyingDecimals: number;
  wrapperSymbol: string;
  wrapperDecimals: number;
  /** Conversion factor: 1 wrapper unit = `rate` underlying units. */
  rate: bigint;
  /** Whether the mock underlying accepts public `mint()`. */
  isFaucetable: boolean;
  /** TVS: inferredTotalSupply on the wrapper, in underlying decimals. */
  tvs: bigint;
}

/**
 * Return all pairs from the registry (including revoked ones — the UI
 * decides whether to gray them out or hide). Uses one `getTokenConfidentialTokenPairs`
 * call then batches metadata reads via multicall.
 */
export async function fetchAllPairs(): Promise<PairInfo[]> {
  const client = publicClient();
  const pairs = (await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getTokenConfidentialTokenPairs",
  })) as readonly { tokenAddress: Address; confidentialTokenAddress: Address; isValid: boolean }[];

  const enriched = await Promise.all(pairs.map(async (p) => enrich(p.tokenAddress, p.confidentialTokenAddress, p.isValid)));
  return enriched;
}

/** Look up a single wrapper's pair info by underlying address. */
export async function fetchPairForUnderlying(underlying: Address): Promise<PairInfo | null> {
  const client = publicClient();
  const [isValid, wrapper] = (await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getConfidentialTokenAddress",
    args: [underlying],
  })) as readonly [boolean, Address];
  if (wrapper === "0x0000000000000000000000000000000000000000") return null;
  return enrich(underlying, wrapper, isValid);
}

/** Look up a single pair by wrapper address. */
export async function fetchPairForWrapper(wrapper: Address): Promise<PairInfo | null> {
  const client = publicClient();
  const [isValid, underlying] = (await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getTokenAddress",
    args: [wrapper],
  })) as readonly [boolean, Address];
  if (underlying === "0x0000000000000000000000000000000000000000") return null;
  return enrich(underlying, wrapper, isValid);
}

async function enrich(underlying: Address, wrapper: Address, isValid: boolean): Promise<PairInfo> {
  const client = publicClient();
  const [uSym, uName, uDec, wSym, wDec, rate, tvs] = await Promise.all([
    client.readContract({ address: underlying, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "???"),
    client.readContract({ address: underlying, abi: ERC20_ABI, functionName: "name" }).catch(() => "Unknown"),
    client.readContract({ address: underlying, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
    client.readContract({ address: wrapper, abi: WRAPPER_ABI, functionName: "symbol" }).catch(() => "c???"),
    client.readContract({ address: wrapper, abi: WRAPPER_ABI, functionName: "decimals" }).catch(() => 6),
    client.readContract({ address: wrapper, abi: WRAPPER_ABI, functionName: "rate" }).catch(() => 1n),
    client.readContract({ address: wrapper, abi: WRAPPER_ABI, functionName: "inferredTotalSupply" }).catch(() => 0n),
  ]);

  const key = underlying.toLowerCase() as Address;
  const knownMock = Object.entries(MOCK_UNDERLYINGS).find(([addr]) => addr.toLowerCase() === key);
  const isFaucetable = !!knownMock && !RESTRICTED_UNDERLYINGS.some((a) => a.toLowerCase() === key);

  return {
    underlying,
    wrapper,
    isValid,
    underlyingSymbol: knownMock ? knownMock[1].symbol : String(uSym),
    underlyingName: knownMock ? knownMock[1].name : String(uName),
    underlyingDecimals: Number(uDec),
    wrapperSymbol: String(wSym),
    wrapperDecimals: Number(wDec),
    rate: rate as bigint,
    isFaucetable,
    tvs: tvs as bigint,
  };
}

/**
 * Read the caller's underlying ERC-20 balance for a pair.
 * The wrapper balance is a ciphertext handle and lives in `balances.getConfidentialBalanceHandle`.
 */
export async function getUnderlyingBalance(underlying: Address, who: Address): Promise<bigint> {
  return (await publicClient().readContract({
    address: underlying,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [who],
  })) as bigint;
}

export async function getAllowance(underlying: Address, owner: Address, spender: Address): Promise<bigint> {
  return (await publicClient().readContract({
    address: underlying,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
}
