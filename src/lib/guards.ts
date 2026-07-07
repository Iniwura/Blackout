// blackout/lib/guards.ts
//
// Preflight validation for the four error cases the bounty calls out:
// missing approvals, insufficient balance, network mismatch, unsupported tokens.
//
// These throw human-readable errors BEFORE a transaction is sent, so the user
// sees "you only have 5 USDC" instead of a raw revert or a MetaMask estimation
// failure. Approvals are handled inside wrap() itself (auto-approve), so the
// guard there only checks that the balance can cover the amount.

import type { Address } from "viem";
import { CHAIN_ID } from "./config";
import { getUnderlyingBalance, type PairInfo } from "./registry";

/** A validation failure the UI can show directly. */
export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

/**
 * Network mismatch. Call before any write. `walletChainId` comes from
 * wagmi's useChainId() or walletClient.chain.id.
 */
export function assertCorrectNetwork(walletChainId: number | undefined): void {
  if (walletChainId === undefined) {
    throw new GuardError("No network detected. Connect your wallet first.");
  }
  if (walletChainId !== CHAIN_ID) {
    throw new GuardError(
      "Wrong network. BLACKOUT runs on Sepolia. Switch your wallet to Sepolia and try again.",
    );
  }
}

/** Reject zero, negative, or unparseable amounts before doing anything. */
export function assertPositiveAmount(amount: bigint, label = "amount"): void {
  if (amount <= 0n) {
    throw new GuardError(`Enter a ${label} greater than zero.`);
  }
}

/**
 * Insufficient balance guard for wrap. Reads the user's underlying balance
 * live and throws a readable error if it cannot cover the amount.
 */
export async function assertSufficientUnderlying(
  pair: PairInfo,
  user: Address,
  amount: bigint,
): Promise<void> {
  const bal = await getUnderlyingBalance(pair.underlying, user).catch(() => 0n);
  if (bal < amount) {
    const sym = pair.underlyingSymbol.toLowerCase();
    throw new GuardError(
      `Insufficient ${sym}. You need more than you hold. Use the faucet to mint test ${sym}.`,
    );
  }
}

/**
 * Unsupported token guard. A pair is unsupported for writes if it was revoked
 * in the registry (isValid false). Reads still work, writes should not.
 */
export function assertSupportedPair(pair: PairInfo): void {
  if (!pair.isValid) {
    throw new GuardError(
      "This pair was revoked in the registry. Wrapping and unwrapping are disabled for it.",
    );
  }
}

/**
 * Unsupported faucet guard. Only mock underlyings expose a public mint.
 */
export function assertFaucetable(pair: PairInfo): void {
  if (!pair.isFaucetable) {
    throw new GuardError(
      "This token has no public faucet. It uses a restricted mint available through other channels.",
    );
  }
}
