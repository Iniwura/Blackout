// blackout/lib/fhe.ts
// The single hardest thing to get right on FHEVM v0.11: the relayer SDK.
// Wraps the three operations we need — client-side encrypt (euint64), user
// decrypt (unmask my balance), and public decrypt with proof (unwrap).

import type { Address } from "viem";
import type { WalletClient } from "viem";

// The relayer SDK is browser-only. In non-browser environments (SSR, tests)
// these helpers throw a friendly error rather than crashing at import time.
type RelayerSDK = typeof import("@zama-fhe/relayer-sdk/web");
type FhevmInstance = Awaited<ReturnType<RelayerSDK["createInstance"]>>;

let _sdk: RelayerSDK | null = null;
let _instance: FhevmInstance | null = null;

async function sdk(): Promise<RelayerSDK> {
  if (typeof window === "undefined") throw new Error("relayer-sdk is browser-only");
  if (!_sdk) _sdk = await import("@zama-fhe/relayer-sdk/web");
  return _sdk;
}

/**
 * Lazy singleton for the FHEVM instance. Two footguns from Redact:
 *  1. Must spread SepoliaConfig AND explicitly override `network: window.ethereum`.
 *     The SDK's `network` field expects a provider, not a URL string.
 *  2. Wait for `initSDK()` before `createInstance()`; the docs make this sound
 *     optional but it isn't in the browser build.
 */
export async function getInstance(): Promise<FhevmInstance> {
  if (_instance) return _instance;
  const { initSDK, createInstance, SepoliaConfig } = await sdk();
  await initSDK();
  const eth = (window as { ethereum?: unknown }).ethereum;
  if (!eth) throw new Error("No injected wallet found");
  _instance = await createInstance({ ...SepoliaConfig, network: eth as never });
  return _instance;
}

/**
 * Encrypt a single uint64 value bound to a specific contract + caller.
 * Returns the ciphertext handle and its input proof, both required by any
 * function that takes an `externalEuint64`.
 *
 * `amount` is in raw wrapper units (i.e. already divided by rate() and scaled
 * to the wrapper's decimals). Callers should never encrypt cleartext larger
 * than 2^64 - 1.
 */
export async function encryptUint64(
  contractAddress: Address,
  userAddress: Address,
  amount: bigint,
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = await getInstance();
  // The relayer SDK is strict about address format: it wants EIP-55 checksummed
  // hex. Coerce defensively so we never trip its internal validators.
  const { getAddress } = await import("viem");
  const c = getAddress(contractAddress);
  const u = getAddress(userAddress);
  const input = instance.createEncryptedInput(c, u);
  input.add64(amount);
  const enc = await input.encrypt();
  // enc.handles[0] and enc.inputProof are Uint8Array (32 and ~100 bytes).
  // viem's writeContract needs `0x`-prefixed hex for bytes32 / bytes params —
  // handing it a Uint8Array causes downstream `.replace is not a function`
  // errors deep in viem's ABI encoder.
  return {
    handle: toHex(enc.handles[0] as Uint8Array),
    inputProof: toHex(enc.inputProof as Uint8Array),
  };
}

/** Uint8Array → 0x-prefixed lowercase hex string. */
function toHex(bytes: Uint8Array): `0x${string}` {
  let s = "0x";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, "0");
  }
  return s as `0x${string}`;
}

/**
 * Decrypt an encrypted balance FOR A SINGLE USER. Requires the caller to be
 * on the ACL list (which the wrapper adds automatically when you hold a
 * confidential balance). Signs an EIP-712 message that the relayer verifies
 * before releasing the plaintext.
 *
 * Third footgun: `startTimeStamp` and `durationDays` MUST be numbers, not
 * strings. The SDK's type error is unhelpful.
 */
export async function userDecryptHandle(
  walletClient: WalletClient,
  userAddress: Address,
  contractAddress: Address,
  handle: string,
): Promise<bigint> {
  const instance = await getInstance();
  const { getAddress } = await import("viem");
  const c = getAddress(contractAddress);
  const u = getAddress(userAddress);
  const keypair = instance.generateKeypair();
  const startTimeStamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    [c],
    startTimeStamp,
    durationDays,
  );
  const signature = await walletClient.signTypedData({
    account: u,
    domain: eip712.domain as never,
    types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification } as never,
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message as never,
  });
  const result = await instance.userDecrypt(
    [{ handle, contractAddress: c }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    [c],
    u,
    startTimeStamp,
    durationDays,
  );
  return BigInt(result[handle] as string | bigint);
}

/**
 * PUBLIC decrypt an ebool/euint value that a contract has explicitly marked
 * publicly-decryptable. Returns the KMS proof material the contract needs
 * to accept the cleartext via `FHE.checkSignatures`.
 *
 * On the Redact lending pool the flow was:
 *   1. pool.requestLoan()  → contract calls FHE.makePubliclyDecryptable(tier)
 *   2. client publicDecryptWithProof(tierHandle)  ← this function
 *   3. pool.finalizeLoan(borrower, cleartext, proof)
 *
 * The wrapper's unwrap flow is identical: the wrapper marks the burned
 * amount publicly-decryptable in `unwrap()`, and `finalizeUnwrap()` takes
 * the returned cleartext and proof.
 */
export async function publicDecryptWithProof(
  handle: string,
): Promise<{ abiEncodedClearValues: `0x${string}`; decryptionProof: `0x${string}` }> {
  const instance = await getInstance();

  // Normalize the handle: the SDK expects a lowercased 0x-prefixed hex string.
  // viem sometimes returns handles as mixed case, and toString() on a bigint
  // returns decimal. Coerce defensively so the SDK's hex.replace() call succeeds.
  let normalized: string;
  if (typeof handle === "string") {
    normalized = handle.toLowerCase().startsWith("0x") ? handle.toLowerCase() : "0x" + handle;
  } else if (typeof handle === "bigint") {
    normalized = "0x" + (handle as bigint).toString(16).padStart(64, "0");
  } else {
    throw new Error(`publicDecryptWithProof: unexpected handle type ${typeof handle}`);
  }

  const result = await instance.publicDecrypt([normalized]);
  // The SDK returns cleartext values and proof material bundled; different SDK
  // versions have used slightly different names, so we defensively pick from
  // either shape. If Zama renames these again, this is the one line to patch.
  const abiEncodedClearValues = (result.abiEncodedClearValues ??
    result.abiEncodedClearTexts) as `0x${string}`;
  const decryptionProof = (result.decryptionProof ?? result.proof) as `0x${string}`;
  if (!abiEncodedClearValues || !decryptionProof) {
    throw new Error("Relayer SDK returned an unexpected shape for publicDecrypt");
  }
  return { abiEncodedClearValues, decryptionProof };
}

/**
 * Read the raw ciphertext handle for someone's confidential balance.
 * The handle is opaque; it only becomes a number via `userDecryptHandle`.
 * Kept here (rather than in registry.ts) because "the handle is a ciphertext"
 * is fundamentally an FHE concept.
 */
export async function getConfidentialBalanceHandle(
  wrapper: Address,
  who: Address,
): Promise<string> {
  const { publicClient } = await import("./clients");
  const { WRAPPER_ABI } = await import("./abi");
  return (await publicClient().readContract({
    address: wrapper,
    abi: WRAPPER_ABI,
    functionName: "confidentialBalanceOf",
    args: [who],
  })) as string;
}
