// blackout/lib/registry.ts
// Reads the wrappers registry and enriches each pair with the metadata a UI
// actually needs: symbol, name, decimals, rate, mintability, user balances.

import type { Address } from "viem";
import { REGISTRY_ADDRESS, MOCK_UNDERLYINGS, RESTRICTED_UNDERLYINGS } from "./config";
import { CUSTOM_PAIRS } from "./customPairs";
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
  /** "registry" for pairs from the onchain registry; "custom" for user-declared. */
  source: "registry" | "custom";
}

/**
 * Return all pairs, merging the onchain registry (source of truth) with the
 * developer-editable customPairs.ts list. Registry pairs come first; custom
 * pairs get flagged with source: "custom" so the UI can badge them.
 */
export async function fetchAllPairs(): Promise<PairInfo[]> {
  const { CUSTOM_PAIRS } = await import("./customPairs");
  const client = publicClient();
  const pairs = (await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getTokenConfidentialTokenPairs",
  })) as readonly { tokenAddress: Address; confidentialTokenAddress: Address; isValid: boolean }[];

  const enriched = await Promise.all(pairs.map(async (p) => enrich(p.tokenAddress, p.confidentialTokenAddress, p.isValid)));

  // Custom pairs pulled in as-is with source: "custom". TVS is read best-effort;
  // if the wrapper does not expose inferredTotalSupply the read simply returns 0n.
  const custom: PairInfo[] = await Promise.all(
    CUSTOM_PAIRS.map(async (c) => {
      const tvs = await client
        .readContract({ address: c.wrapper, abi: WRAPPER_ABI, functionName: "inferredTotalSupply" })
        .catch(() => 0n);
      return {
        underlying: c.underlying,
        wrapper: c.wrapper,
        isValid: true,
        underlyingSymbol: c.underlyingSymbol,
        underlyingName: c.underlyingName,
        underlyingDecimals: c.underlyingDecimals,
        wrapperSymbol: c.wrapperSymbol,
        wrapperDecimals: c.wrapperDecimals,
        rate: c.rate,
        isFaucetable: c.isFaucetable,
        tvs: tvs as bigint,
        source: "custom" as const,
      };
    }),
  );

  return [...enriched, ...custom];
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
  if (underlying !== "0x0000000000000000000000000000000000000000") {
    return enrich(underlying, wrapper, isValid);
  }
  // Fallback: is it in customPairs?
  const { CUSTOM_PAIRS } = await import("./customPairs");
  const match = CUSTOM_PAIRS.find((c) => c.wrapper.toLowerCase() === wrapper.toLowerCase());
  if (!match) return null;
  const tvs = await client
    .readContract({ address: match.wrapper, abi: WRAPPER_ABI, functionName: "inferredTotalSupply" })
    .catch(() => 0n);
  return {
    underlying: match.underlying,
    wrapper: match.wrapper,
    isValid: true,
    underlyingSymbol: match.underlyingSymbol,
    underlyingName: match.underlyingName,
    underlyingDecimals: match.underlyingDecimals,
    wrapperSymbol: match.wrapperSymbol,
    wrapperDecimals: match.wrapperDecimals,
    rate: match.rate,
    isFaucetable: match.isFaucetable,
    tvs: tvs as bigint,
    source: "custom",
  };
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
    source: "registry" as const,
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
