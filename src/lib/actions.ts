// blackout/lib/actions.ts
// Top-level action functions the UI calls. Each one is a self-contained flow
// with proper receipt-status checks and self-relay handling for anything
// touching FHE.

import type { Address, WalletClient } from "viem";
import { decodeEventLog } from "viem";
import { publicClient, mustSucceed } from "./clients";
import { ERC20_ABI, WRAPPER_ABI } from "./abi";
import {
  encryptUint64,
  userDecryptHandle,
  publicDecryptWithProof,
  getConfidentialBalanceHandle,
} from "./fhe";
import { getAllowance, type PairInfo } from "./registry";

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

/* ------------------------------------------------------------------ */
/*  FAUCET                                                             */
/* ------------------------------------------------------------------ */

/**
 * Mint mock underlying tokens. Only works on the mock underlyings — the
 * caller should check `pair.isFaucetable` first and hide the button otherwise.
 * `amount` is in the underlying's smallest unit (i.e. already scaled by decimals).
 */
export async function faucet(
  walletClient: WalletClient,
  user: Address,
  underlying: Address,
  amount: bigint,
): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    address: underlying,
    abi: ERC20_ABI,
    functionName: "mint",
    args: [user, amount],
    account: user,
    chain: walletClient.chain,
  });
  await mustSucceed(hash, "Faucet mint");
  return hash;
}

/* ------------------------------------------------------------------ */
/*  WRAP: ERC-20 → confidential                                        */
/* ------------------------------------------------------------------ */

/**
 * Full wrap flow with optional approve step. Returns the wrap tx hash.
 *
 * NOTE ON `amount`: uses the underlying's decimals (per docs), not the wrapper's.
 * The wrapper will round down and refund any dust that's smaller than `rate()`.
 */
export async function wrap(
  walletClient: WalletClient,
  user: Address,
  pair: PairInfo,
  amount: bigint,
  onStep?: (msg: string) => void,
): Promise<`0x${string}`> {
  // Skip approve if allowance already covers this amount.
  const existing = await getAllowance(pair.underlying, user, pair.wrapper);
  if (existing < amount) {
    onStep?.("1/2 Approving the wrapper to move your tokens...");
    const approveHash = await walletClient.writeContract({
      address: pair.underlying,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [pair.wrapper, amount],
      account: user,
      chain: walletClient.chain,
    });
    await mustSucceed(approveHash, "Approve");
  }

  onStep?.("2/2 Wrapping. Your balance goes dark on the next block.");
  const wrapHash = await walletClient.writeContract({
    address: pair.wrapper,
    abi: WRAPPER_ABI,
    functionName: "wrap",
    args: [user, amount],
    account: user,
    chain: walletClient.chain,
  });
  await mustSucceed(wrapHash, "Wrap");
  return wrapHash;
}

/* ------------------------------------------------------------------ */
/*  DECRYPT MY BALANCE (private to the caller)                         */
/* ------------------------------------------------------------------ */

/**
 * Unmask the caller's confidential balance for a specific wrapper.
 * Returns the cleartext balance in wrapper units. To display in
 * underlying terms, multiply by `pair.rate` and divide by 10^underlyingDecimals.
 *
 * Returns `null` if the user has never held this token (handle is zero) —
 * the UI should show a "0" placeholder rather than an error.
 */
export async function decryptMyBalance(
  walletClient: WalletClient,
  user: Address,
  wrapper: Address,
): Promise<bigint | null> {
  const handle = await getConfidentialBalanceHandle(wrapper, user);
  if (handle === ZERO_HANDLE) return 0n;
  return await userDecryptHandle(walletClient, user, wrapper, handle);
}

/* ------------------------------------------------------------------ */
/*  UNWRAP: confidential → ERC-20  (two-step)                          */
/* ------------------------------------------------------------------ */

/**
 * Step 1 of unwrap. Encrypts the caller's requested amount (in WRAPPER units),
 * submits `unwrap()`, and pulls the `unwrapRequestId` from the receipt.
 * The request now sits onchain waiting for its cleartext + proof.
 */
export async function requestUnwrap(
  walletClient: WalletClient,
  user: Address,
  pair: PairInfo,
  amountInWrapperUnits: bigint,
  to?: Address,
): Promise<{ requestId: `0x${string}`; wrapHash: `0x${string}` }> {
  const dest = to ?? user;
  const { handle, inputProof } = await encryptUint64(pair.wrapper, user, amountInWrapperUnits);

  const hash = await walletClient.writeContract({
    address: pair.wrapper,
    abi: WRAPPER_ABI,
    functionName: "unwrap",
    args: [user, dest, handle, inputProof],
    account: user,
    chain: walletClient.chain,
  });
  const receipt = await mustSucceed(hash, "Unwrap request");

  // Pull requestId from UnwrapRequested. Doing it this way, not by re-reading
  // pending state, dodges the race between the tx landing and the read.
  let requestId: `0x${string}` | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: WRAPPER_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === "UnwrapRequested") {
        requestId = (decoded.args as { unwrapRequestId: `0x${string}` }).unwrapRequestId;
        break;
      }
    } catch {
      /* not our event */
    }
  }
  if (!requestId) throw new Error("Wrap succeeded but no UnwrapRequested event was found.");
  return { requestId, wrapHash: hash };
}

/**
 * Step 2 of unwrap. Fetches the KMS proof for the burned-amount handle
 * associated with this request, then submits `finalizeUnwrap`. The chain
 * verifies the proof via `FHE.checkSignatures` and moves the underlying
 * tokens to the receiver.
 *
 * This is the same self-relay pattern our lending pool uses, and the
 * relayer SDK helper (`publicDecryptWithProof`) is completely reusable.
 */
export async function finalizeUnwrap(
  walletClient: WalletClient,
  user: Address,
  pair: PairInfo,
  requestId: `0x${string}`,
): Promise<`0x${string}`> {
  // Read the burned-amount handle back from the contract.
  const burnedHandle = (await publicClient().readContract({
    address: pair.wrapper,
    abi: WRAPPER_ABI,
    functionName: "unwrapAmount",
    args: [requestId],
  })) as string;
  if (!burnedHandle || burnedHandle === ZERO_HANDLE) {
    throw new Error("No burned-amount handle found for this request. Was it already finalized?");
  }

  const proof = await publicDecryptWithProof(burnedHandle);
  const cleartext = BigInt(proof.abiEncodedClearValues); // first 32 bytes = uint64 padded

  const hash = await walletClient.writeContract({
    address: pair.wrapper,
    abi: WRAPPER_ABI,
    functionName: "finalizeUnwrap",
    args: [requestId, cleartext, proof.decryptionProof],
    account: user,
    chain: walletClient.chain,
  });
  await mustSucceed(hash, "Finalize unwrap");
  return hash;
}

/**
 * Check whether a pending unwrap request exists onchain that we should
 * resume rather than kick off from scratch. Returns null if none.
 * The UI can use this on load to say "resume pending unwrap" instead of
 * starting a fresh flow.
 */
export async function findPendingUnwrap(
  pair: PairInfo,
  user: Address,
  requestId: `0x${string}`,
): Promise<boolean> {
  const requester = (await publicClient().readContract({
    address: pair.wrapper,
    abi: WRAPPER_ABI,
    functionName: "unwrapRequester",
    args: [requestId],
  })) as Address;
  return requester.toLowerCase() === user.toLowerCase();
}
