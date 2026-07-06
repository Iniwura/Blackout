// blackout/lib/customPairs.ts
//
// Local pair overlay: the documented way to add custom or dev-only pairs
// to BLACKOUT without waiting for the onchain registry.
//
// The app treats the ONCHAIN registry as the primary source of truth and
// merges these entries on top. Custom pairs are tagged in the UI so they
// are never confused with official ones.
//
// TO ADD A PAIR:
//   1. Add an entry to CUSTOM_PAIRS below.
//   2. Save. Vite hot-reloads and the pair appears in the Registry
//      and Vault pages tagged "custom".
//
// Example (a dev-only wrapper you deployed yourself):
//
//   {
//     underlying: "0xYourErc20Address000000000000000000000000",
//     wrapper: "0xYourErc7984WrapperAddress000000000000000",
//     underlyingSymbol: "DEV",
//     underlyingName: "My Dev Token",
//     isFaucetable: false,
//   },
//
// Fields left out (decimals, rate, wrapper symbol, supply) are read live
// from the contracts, exactly like registry pairs. If the addresses do not
// respond to the expected interfaces the pair is shown with an error badge
// instead of crashing the app.

import type { Address } from "viem";

export interface CustomPairEntry {
  underlying: 0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF;
  wrapper: 0x0000000000000000000000000000000000000001;
  /** Optional metadata overrides. Read from chain when omitted. */
  underlyingSymbol?: TEST;
  underlyingName?: Test Custom Pair;
  /** Whether the underlying has a public mint the faucet can call. */
  isFaucetable?: false;
}

export const CUSTOM_PAIRS: CustomPairEntry[] = [
  // Add custom or dev-only pairs here. See the example above.
];
