// blackout/lib/config.ts
// Addresses verified against Zama's registry on Sepolia (fetched via
// getTokenConfidentialTokenPairs, then confirmed matching what the chain returns).

import type { Address } from "viem";
import { sepolia } from "viem/chains";

export const CHAIN = sepolia;
export const CHAIN_ID = 11155111;

/** Zama Confidential Wrappers Registry on Sepolia */
export const REGISTRY_ADDRESS: Address = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

/**
 * Mock underlyings with public 1M/call mint. Verified live from the registry.
 * The registry is source of truth for pairs; this map only signals which
 * underlyings are faucetable (as opposed to the restricted-mint tokens).
 */
export const MOCK_UNDERLYINGS: Record<string, { symbol: string; name: string }> = {
  "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff": { symbol: "USDC", name: "USD Coin (Mock)" },
  "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0": { symbol: "USDT", name: "Tether (Mock)" },
  "0xff54739b16576fa5402f211d0b938469ab9a5f3f": { symbol: "WETH", name: "Wrapped Ether (Mock)" },
  "0xff021fb13ca64e5354c62c954b949a88cfdeb25e": { symbol: "BRON", name: "Bronto (Mock)" },
  "0x75355a85c6fb9df5f0c80ff54e8747eee9a0bf57": { symbol: "ZAMA", name: "Zama (Mock)" },
  "0x93c931278a2aad1916783f952f94276ea5111442": { symbol: "tGBP", name: "Test GBP (Mock)" },
  "0x24377ae4aa0c45ecee71225007f17c5d423dd940": { symbol: "XAUt", name: "Tether Gold (Mock)" },
  "0x6ab54988261aec573a2ca13cf802d3b1114f864c": { symbol: "steakcUSDC", name: "Steakhouse cUSDC (Mock)" },
};

/** Restricted-mint underlyings (faucet UI disables mint on these). */
export const RESTRICTED_UNDERLYINGS: string[] = ["0xf6ef9adb61a48e29e36bc873070a46a3d2667ff3"];

/** Public RPCs. publicnode for reads/writes, drpc for eth_getLogs. */
export const RPC_MAIN = "https://ethereum-sepolia-rpc.publicnode.com";
export const RPC_LOGS = "https://sepolia.drpc.org";

/** Mint 100 units, scaled per token decimals by the caller. */
export const FAUCET_UNITS = 100;

/** Chunked log scans (drpc caps at 10k, we use 9999 to be safe). */
export const LOG_CHUNK = 9_999n;
export const LOG_CHUNKS = 12n; // ≈ 2 weeks of Sepolia
