# BLACKOUT

**Public by default is a bug.**

BLACKOUT is a privacy control room for your Ethereum wallet. Every ERC-20 you hold is broadcasting the balance. BLACKOUT surfaces every ERC-20 ↔ ERC-7984 wrapper pair in the Zama Wrappers Registry on Sepolia, lets you wrap and unwrap into confidential tokens, decrypts any ERC-7984 balance under an EIP-712 signature, and includes a faucet for every mock underlying.

Built for the Zama Developer Program Mainnet Season 3 Bounty Track.

- Live: [blackout-alpha.vercel.app](https://blackout-alpha.vercel.app)
- Registry: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` on Sepolia
- SDK: `@zama-fhe/relayer-sdk@0.4.4`

## What makes it different

Every submission this month builds the same checklist. BLACKOUT reframes the checklist as a story.

- **GO DARK on everything.** One button on the Vault wraps every token you are currently leaking. Batched, sequenced, done.
- **X-RAY toggle.** See the same wallet twice: your view with cleartext balances, the world's view with `[SEALED]` bars where your amounts are. Teaches ERC-7984 in one click.
- **Privacy score.** Portfolio scores your wallet 0 to 100 percent based on how much of your position is sealed. Watch it climb as you wrap.
- **Surveillance feed.** Recent Sepolia events across every pair, side by side. Public transfers show the amount. Wraps and confidential transfers show `[ sealed ]`. Same chain, same block, one is visible and one is not.
- **Reveal any token.** Paste any ERC-7984 wrapper address, we look it up in the registry, then decrypt your balance on it. Insurance for the "any balance" wording in the bounty.
- **Home walkthrough.** Five clickable steps guide a first-time visitor through the full flow.

## What the checklist gives you

The bounty asks for four things. Each is present.

- **Surfaces every registry pair.** The `/registry` page reads `getTokenConfidentialTokenPairs()` as the primary source of truth, then merges the local `customPairs.ts` overlay for custom and dev-only pairs (tagged CUSTOM). All nine official pairs show, including the revoked entry (greyed with a `REVOKED` badge). Duplicate underlying symbols are flagged. Unknown metadata gets a review tag.
- **Wrap and unwrap.** The `/vault` page has both, on every pair, with auto-approve and the self-relay unwrap flow (encrypt amount, request, fetch KMS proof, finalize).
- **Decrypt any ERC-7984 balance.** The `/reveal` page (Decrypt) accepts any ERC-7984 address, registered or not. Registry pairs get full metadata. Unknown tokens are probed directly from the contract and decrypted through the same EIP-712 user decryption flow.
- **Faucet for the mocks.** The `/faucet` page has one-click mint for every mock underlying. Restricted-mint tokens like ctGBP are listed but disabled with an explanation.

## How to run it

```bash
git clone https://github.com/Iniwura/blackout
cd blackout
npm install
npm run dev
```

Open http://localhost:5173.

### Wallet setup

- Connect a wallet with some Sepolia ETH for gas.
- Hit the faucet page to mint mock underlying tokens.
- Go to the Vault to wrap them.

## Architecture

Frontend only. No custom contracts. Everything integrates against Zama's deployed infrastructure.

```
src/
  lib/
    config.ts       registry + mock addresses, RPCs
    abi.ts          minimal ABIs for registry, wrapper, ERC-20
    clients.ts      viem publicClient (reads) + logsClient (drpc) + mustSucceed
    registry.ts     fetchAllPairs, single lookups, faucetability tagging
    fhe.ts          initSDK, encryptUint64, userDecryptHandle, publicDecryptWithProof
    actions.ts      faucet, wrap, decryptMyBalance, requestUnwrap, finalizeUnwrap
    events.ts       fetchRecentFeed (chunked getLogs), privacyScore
    format.ts       decimal-aware formatters
  components/
    HeroVisual.tsx  custom SVG hero, no stock media
    SideMarkers.tsx vertical marker text with scroll parallax
    CopyButton.tsx  clipboard button with fade feedback
  pages/
    Home.tsx        hero + walkthrough + closer
    Vault.tsx       X-RAY toggle, GO DARK batch, per-token wrap and unwrap
    Portfolio.tsx   wallet id, privacy score meter, positions table
    Registry.tsx    all pairs, filters (all / valid / revoked), badges
    Faucet.tsx      mint 100 or 1000 of any mock, restricted section
    Feed.tsx        surveillance panel, LEAK vs SEALED
    Reveal.tsx      arbitrary wrapper address decrypt
```


## Adding a new ERC-20 to ERC-7984 pair

The Zama Wrappers Registry at `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` is the primary source of truth. Every valid pair the registry knows about appears in the app automatically, no code changes required. When Zama adds a new wrapper, it shows up on the next page load.

The app also supports **custom pairs**: developer-declared entries for wrappers that are not yet in the registry, dev-only tokens, or unregistered ones you want the app to know about. Custom pairs live in a single file, `src/lib/customPairs.ts`, and are merged into every page (Vault, Registry, Portfolio, Decrypt) at runtime.

### Example

To add a hypothetical `MYTKN <-> cMYTKN` pair, open `src/lib/customPairs.ts` and add an entry to the `CUSTOM_PAIRS` array:

```ts
export const CUSTOM_PAIRS: CustomPair[] = [
  {
    underlying: "0xYourUnderlyingERC20Address",
    wrapper:    "0xYourConfidentialWrapperAddress",
    underlyingSymbol: "MYTKN",
    underlyingName:   "My Custom Token",
    underlyingDecimals: 18,
    wrapperSymbol:  "cMYTKN",
    wrapperDecimals: 6,
    rate: 1_000_000_000_000n, // 10^(underlyingDecimals - wrapperDecimals)
    isFaucetable: false,       // set true if the underlying has a public mint()
  },
];
```

Save, and the pair appears everywhere:

- **Registry** lists it with a `CUSTOM` badge so users see it is not registry-endorsed.
- **Vault** shows a wrap/unwrap panel for it. If `isFaucetable` is true, the inline faucet button appears.
- **Portfolio** counts it toward the privacy score and shows it in the positions table.
- **Decrypt** finds it by wrapper address alongside registry entries.

Custom pairs use the same FHE encryption, EIP-712 decryption, and self-relay unwrap flow as registry pairs. There is no separate code path.

### When to use the registry vs custom

Prefer the registry. If a pair is production-worthy it should be submitted to Zama for inclusion in the canonical registry so every dApp benefits from it. Custom pairs are for development-time work, testing, or transitional periods before registry submission.


## Adding a new ERC-20 ↔ ERC-7984 pair

BLACKOUT sources pairs as a hybrid. The onchain Zama Wrappers Registry is the primary source of truth, read live on every load. On top of that, a local overlay file lets you declare custom or dev-only pairs without waiting for onchain registration.

### The official path

If your pair should be canonical for the whole ecosystem, register it in the Zama Wrappers Registry itself. Once the registry admin adds it, BLACKOUT picks it up automatically on the next page load with zero code changes. Unknown pairs surface with an UNKNOWN badge until their metadata is curated, so nothing breaks in the meantime.

### The local path

For development, testing, or pairs that are not yet in the registry, add an entry to `src/lib/customPairs.ts`:

```ts
export const CUSTOM_PAIRS: CustomPairEntry[] = [
  {
    underlying: "0xYourErc20Address000000000000000000000000",
    wrapper: "0xYourErc7984WrapperAddress000000000000000",
    underlyingSymbol: "DEV",
    underlyingName: "My Dev Token",
    isFaucetable: false,
  },
];
```

Save the file. Vite hot-reloads, and the pair appears in the Registry and Vault tagged CUSTOM so it is never confused with an official entry. Decimals, rate, wrapper symbol, and supply are read live from the contracts, exactly like registry pairs. If the wrapper address exists in both the registry and the overlay, the official registry entry wins and the duplicate is skipped.

Wrap, unwrap, and decrypt all work identically for custom pairs because every flow reads its parameters from the pair object, not from hardcoded lists.

## Footguns handled

Everything below cost time to debug. Fixes are inline in the code.

- **COOP / COEP headers required.** The relayer SDK loads WASM with threads. Without `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` served with the page, initSDK silently no-ops. Handled in `vite.config.ts` for dev and `vercel.json` for production.
- **WASM MIME type.** Vite occasionally serves node_modules WASM with the wrong content type. A tiny middleware in `vite.config.ts` forces `application/wasm`.
- **relayer-sdk excluded from optimizeDeps.** Vite's pre-bundling rewrites the SDK's asset URLs and breaks the loader.
- **Address checksumming.** The SDK's input validation refuses non-EIP-55 addresses. `encryptUint64` and `userDecryptHandle` both call `getAddress()` before passing anything to the SDK.
- **Handles come back as Uint8Array.** The SDK returns encryption results as raw byte arrays. viem's `writeContract` needs `0x`-prefixed hex for bytes and bytes32 args. If you hand it Uint8Array you get `hex_.replace is not a function` deep in the ABI encoder. Converted at the fhe.ts boundary.
- **Numeric timestamps.** `userDecrypt` demands number, not string, for `startTimeStamp` and `durationDays`.
- **`window.ethereum` in SepoliaConfig.** The SDK's `network` field wants a provider, not a URL. Spread with `{ ...SepoliaConfig, network: window.ethereum }`.
- **`mustSucceed` on every write.** Reverted transactions produce receipts too. Only `.status === "success"` is safe.
- **UnwrapRequested event, not state read.** Race conditions between tx landing and post-tx state reads gave stale results. We decode the event log for the requestId instead.
- **publicnode blocks eth_getLogs.** Feed uses drpc.org, chunked to 9,999 blocks per call because drpc caps ranges.

## Honest limits

- **No mainnet.** The bounty specifies Sepolia. Adding mainnet reads would require another `PublicClient` and network selector.
- **Faucet does not sponsor gas.** Users need their own Sepolia ETH.
- **Batch wrap is client-side sequential.** A future `goDarkBatch()` helper contract would collapse the whole thing into one signature. Deliberately out of scope for a frontend bounty.
- **The relayer SDK singleton needs a page reload if it gets into a bad state.** We reset on wallet change but do not auto-recover from every failure mode.
- **`isValid=false` pairs are shown but not wrapped or unwrapped through.** The registry entry may be legitimate but our UI blocks writes to be safe. Users can still see them.

## Feedback for Zama

The biggest friction on this build was the same one we hit on the previous submission: the WASM threading requirements are not documented near the relayer SDK quickstart. `crossOriginIsolated`, WASM MIME type, and `optimizeDeps.exclude` are all non-obvious and none of them appear in the SDK's README. A single "vite + relayer-sdk" page would save every builder a full day.

Second, the SDK returns `Uint8Array` for handles but the underlying wrapper functions want `bytes32` hex on the writeContract side. The type declaration says both are `Uint8Array | string` so TypeScript does not catch the mismatch. A clearer return type or a docs note would help.

Everything else was clean. The registry, wrapper, and mock underlyings are exactly the right shape for building against.

## License

MIT.
