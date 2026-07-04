// blackout/lib/format.ts
// Small pure helpers for display. Kept separate from actions/events so the
// UI can import them without pulling in viem or the relayer SDK.

import type { PairInfo } from "./registry";

/** Format a raw underlying amount using its decimals. */
export function formatUnderlying(amount: bigint, pair: Pick<PairInfo, "underlyingDecimals">): string {
  return formatUnits(amount, pair.underlyingDecimals);
}

/**
 * Convert a wrapper-unit balance to the underlying's decimal scale.
 * Given `1000000` (wrapper units, 6dp) and rate `10^12`, returns "1.000000"
 * for an 18dp underlying — because 1000000 * 10^12 = 10^18 = 1 underlying.
 */
export function wrapperBalanceToUnderlying(
  wrapperAmount: bigint,
  pair: Pick<PairInfo, "rate" | "underlyingDecimals" | "wrapperDecimals">,
): string {
  const raw = wrapperAmount * pair.rate;
  return formatUnits(raw, pair.underlyingDecimals);
}

/**
 * Convert a user-entered decimal string like "1.5" to a raw underlying amount.
 * Truncates (rounds toward zero) if the user types more decimals than the
 * underlying supports.
 */
export function parseUnderlying(value: string, decimals: number): bigint {
  return parseUnits(value.trim(), decimals);
}

/** Same, but produces a wrapper-unit amount (for unwrap). */
export function parseAsWrapperUnits(value: string, wrapperDecimals: number): bigint {
  return parseUnits(value.trim(), wrapperDecimals);
}

/* ---------- generic viem-style unit helpers, kept local ---------- */

function formatUnits(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString();
  const s = amount.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function parseUnits(value: string, decimals: number): bigint {
  const [whole, frac = ""] = value.split(".");
  const cleanWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const cleanFrac = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(cleanWhole + cleanFrac);
}

/** For the surveillance feed: display a real amount or the redaction placeholder. */
export function displayAmount(
  amount: bigint | undefined,
  pair: Pick<PairInfo, "underlyingDecimals" | "underlyingSymbol">,
): string {
  if (amount === undefined) return "[SEALED]";
  return `${formatUnits(amount, pair.underlyingDecimals)} ${pair.underlyingSymbol}`;
}

/** Truncate an address for compact display. */
export function shortAddr(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
