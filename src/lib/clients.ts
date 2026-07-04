// blackout/lib/clients.ts
// Two viem clients: a "main" one on publicnode for reads and writes, and a
// "logs" one on drpc which is the only free public RPC that accepts
// eth_getLogs (a lesson learned the hard way on the Redact deploy).

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { CHAIN, RPC_MAIN, RPC_LOGS } from "./config";

let _main: PublicClient | null = null;
let _logs: PublicClient | null = null;

export function publicClient(): PublicClient {
  if (!_main) _main = createPublicClient({ chain: CHAIN, transport: http(RPC_MAIN) });
  return _main;
}

export function logsClient(): PublicClient {
  if (!_logs) _logs = createPublicClient({ chain: CHAIN, transport: http(RPC_LOGS) });
  return _logs;
}

/**
 * Wallet client built on window.ethereum. Whatever wallet-connection layer
 * the frontend uses (RainbowKit, plain injected, etc.) it exposes an EIP-1193
 * provider, and this reads it off `window.ethereum`. For RainbowKit apps this
 * function isn't strictly needed — wagmi's `useWalletClient` covers it.
 */
export function walletClient(): WalletClient {
  const eth = (window as { ethereum?: unknown }).ethereum;
  if (!eth) throw new Error("No injected wallet found");
  return createWalletClient({ chain: CHAIN, transport: custom(eth as never) });
}

/**
 * Wait for a tx AND assert it succeeded. Reverted transactions produce
 * receipts too — checking `.status === "success"` is the only safe check.
 * Redact shipped a bug for a day because we forgot this.
 */
export async function mustSucceed(hash: `0x${string}`, label: string) {
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} reverted (tx ${hash.slice(0, 10)}...). See Etherscan for the reason.`);
  }
  return receipt;
}
