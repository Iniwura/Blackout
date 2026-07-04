// blackout/lib/events.ts
// Reads recent Transfer / Wrap / ConfidentialTransfer events. Powers two
// features unique to BLACKOUT:
//   - the "surveillance feed" showing public leaks vs sealed transfers
//   - the "privacy score" showing how much of the user's portfolio is dark
//
// Uses the drpc client because publicnode blocks eth_getLogs. drpc caps
// windows at 10k blocks per request, so we walk backwards in chunks.

import type { Address } from "viem";
import { parseAbiItem } from "viem";
import { logsClient } from "./clients";
import { LOG_CHUNK, LOG_CHUNKS } from "./config";
import type { PairInfo } from "./registry";

export interface FeedEvent {
  kind: "public-transfer" | "wrap" | "confidential-transfer";
  blockNumber: bigint;
  txHash: `0x${string}`;
  from?: Address;
  to?: Address;
  /** Cleartext amount for public transfers; undefined for confidential ones. */
  amount?: bigint;
  pair: PairInfo;
}

/**
 * Walk backwards from `latest` in 9,999-block chunks to gather recent events.
 * Returns them newest-first. `pairs` should be a small list (typically the
 * whole registry) to keep RPC calls reasonable.
 */
export async function fetchRecentFeed(pairs: PairInfo[], maxItems = 30): Promise<FeedEvent[]> {
  const client = logsClient();
  const latest = await client.getBlockNumber();
  const feed: FeedEvent[] = [];

  const transferSig = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
  const wrapSig = parseAbiItem(
    "event Wrap(address indexed to, uint256 roundedAmount, bytes32 encryptedWrappedAmount)",
  );
  const cTransferSig = parseAbiItem(
    "event ConfidentialTransfer(address indexed from, address indexed to, bytes32 encryptedAmount)",
  );

  for (let i = 0n; i < LOG_CHUNKS && feed.length < maxItems; i++) {
    const to = latest - i * LOG_CHUNK;
    if (to <= 0n) break;
    const from = to > LOG_CHUNK ? to - LOG_CHUNK + 1n : 0n;

    // Fetch each event type for each address in parallel. This is fan-out
    // heavy but each call is tiny; drpc handles it fine.
    const results = await Promise.all(
      pairs.flatMap((p) => [
        client
          .getLogs({ address: p.underlying, event: transferSig, fromBlock: from, toBlock: to })
          .then((logs) => logs.map((l) => ({ kind: "public-transfer" as const, log: l, pair: p })))
          .catch(() => []),
        client
          .getLogs({ address: p.wrapper, event: wrapSig, fromBlock: from, toBlock: to })
          .then((logs) => logs.map((l) => ({ kind: "wrap" as const, log: l, pair: p })))
          .catch(() => []),
        client
          .getLogs({ address: p.wrapper, event: cTransferSig, fromBlock: from, toBlock: to })
          .then((logs) => logs.map((l) => ({ kind: "confidential-transfer" as const, log: l, pair: p })))
          .catch(() => []),
      ]),
    );

    for (const batch of results) {
      for (const item of batch) {
        const args = item.log.args as {
          from?: Address;
          to?: Address;
          value?: bigint;
          roundedAmount?: bigint;
        };
        feed.push({
          kind: item.kind,
          blockNumber: item.log.blockNumber ?? 0n,
          txHash: item.log.transactionHash ?? "0x",
          from: args.from,
          to: args.to,
          amount: item.kind === "public-transfer" ? args.value : item.kind === "wrap" ? args.roundedAmount : undefined,
          pair: item.pair,
        });
      }
    }
  }

  return feed.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1)).slice(0, maxItems);
}

/**
 * Compute a "privacy score" (0-100) for a wallet.
 *
 *   score = (# pairs the user has ANY confidential balance in) /
 *           (# pairs the user has ANY position in — public or confidential) * 100
 *
 * The caller supplies the confidential balances they've already decrypted;
 * we don't force a decryption here because it costs the user a signature.
 * Instead we look at underlying balances (public) and check which of them
 * the user has "gone dark" on.
 *
 * Passing `hasCBalance = null` for pairs the user hasn't decrypted yet is
 * fine — those pairs are simply excluded from the numerator. The UI can
 * offer "unmask everything" to make the score more accurate.
 */
export function privacyScore(
  pairs: PairInfo[],
  underlyingBalances: Record<Address, bigint>,
  confidentialBalances: Record<Address, bigint | null>,
): { score: number; numerator: number; denominator: number } {
  let numerator = 0;
  let denominator = 0;
  for (const p of pairs) {
    if (!p.isValid) continue;
    const pub = underlyingBalances[p.underlying] ?? 0n;
    const conf = confidentialBalances[p.wrapper];
    const hasPublic = pub > 0n;
    const hasConf = conf !== undefined && conf !== null && conf > 0n;
    if (hasPublic || hasConf) denominator += 1;
    if (hasConf && !hasPublic) numerator += 1;
    // Partial (has both) counts as half-dark.
    else if (hasConf && hasPublic) numerator += 0.5;
  }
  const score = denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
  return { score, numerator, denominator };
}
