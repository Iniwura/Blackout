import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import CopyButton from "../components/CopyButton";
import {
  fetchPairForWrapper, decryptMyBalance, wrapperBalanceToUnderlying,
  getConfidentialBalanceHandle, userDecryptHandle,
  publicClient,
  WRAPPER_ABI,
  type PairInfo,
} from "../lib";

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Decrypt page: user decryption for ANY ERC-7984 token the connected wallet
 * holds, registered in the Zama registry or not. Registry pairs get full
 * metadata; unknown tokens fall back to reading symbol and decimals from
 * the contract itself.
 */
export default function Reveal() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [input, setInput] = useState("");
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [unknownToken, setUnknownToken] = useState<{ address: Address; symbol: string; decimals: number } | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function lookup() {
    setError("");
    setPair(null);
    setUnknownToken(null);
    setBalance(null);
    const addr = input.trim() as Address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return setError("that is not a valid ethereum address");
    }
    try {
      setBusy("checking the registry...");
      const p = await fetchPairForWrapper(addr);
      if (p) {
        setPair(p);
        return;
      }
      // Not in the registry. Try treating it as a raw ERC-7984: read symbol,
      // decimals, and confirm it exposes confidentialBalanceOf.
      setBusy("not in the registry. probing the contract directly...");
      const client = publicClient();
      const [symbol, decimals] = await Promise.all([
        client.readContract({ address: addr, abi: WRAPPER_ABI, functionName: "symbol" }).catch(() => "???"),
        client.readContract({ address: addr, abi: WRAPPER_ABI, functionName: "decimals" }).catch(() => 6),
      ]);
      // Confirm the confidential balance read works before showing the panel
      if (!address) throw new Error("connect a wallet first");
      await getConfidentialBalanceHandle(addr, address);
      setUnknownToken({ address: addr, symbol: String(symbol), decimals: Number(decimals) });
    } catch (e) {
      setError(
        "this address does not behave like an ERC-7984 token. " +
        String(e instanceof Error ? e.message : e),
      );
    } finally {
      setBusy("");
    }
  }

  async function revealRegistry() {
    if (!pair || !address || !walletClient) return;
    setError("");
    try {
      setBusy("sign to decrypt your balance...");
      const b = await decryptMyBalance(walletClient, address, pair.wrapper);
      setBalance(b);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy("");
    }
  }

  async function revealUnknown() {
    if (!unknownToken || !address || !walletClient) return;
    setError("");
    try {
      setBusy("reading the encrypted handle...");
      const handle = await getConfidentialBalanceHandle(unknownToken.address, address);
      if (handle === ZERO_HANDLE) {
        setBalance(0n);
        return;
      }
      setBusy("sign to decrypt your balance...");
      const b = await userDecryptHandle(walletClient, address, unknownToken.address, handle);
      setBalance(b);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy("");
    }
  }

  function fmtUnknown(b: bigint, decimals: number): string {
    if (decimals === 0) return b.toString();
    const s = b.toString().padStart(decimals + 1, "0");
    const whole = s.slice(0, -decimals);
    const frac = s.slice(-decimals).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : whole;
  }

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ DECRYPT ]</p>
        <h1 className="page-h">
          <span>paste any ERC-7984.</span>
          <span className="mega-outline">read your sealed balance.</span>
        </h1>
        <p className="page-copy">
          Works for every confidential token, registered in the Zama registry or not. We check the registry
          first for full metadata. If the token is unknown we probe the contract directly and still let you
          decrypt <em>your</em> balance on it. Only your signature opens it, through the EIP-712 user
          decryption flow. Same guarantee as everywhere else in this app.
        </p>
      </section>

      {!isConnected ? (
        <div className="empty-shell">
          <p className="empty-msg">connect a wallet to decrypt a sealed balance</p>
        </div>
      ) : (
        <div className="reveal-block">
          <div className="reveal-label mono">ERC-7984 token address</div>
          <div className="reveal-row">
            <input
              className="amount-input mono grow"
              type="text"
              placeholder="0x…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!!busy}
              spellCheck={false}
            />
            <button className="inline-btn primary" onClick={lookup} disabled={!!busy || !input}>look up</button>
          </div>

          {pair && (
            <div className="panel" style={{ marginTop: 22 }}>
              <div className="panel-h">
                <span className="panel-sym">{pair.underlyingSymbol.toLowerCase()}</span>
                <span className="panel-x">↔</span>
                <span className="panel-sym-mono">{pair.wrapperSymbol.toLowerCase()}</span>
                <span className="quiet-chip mono" style={{ marginLeft: "auto" }}>registry pair</span>
                {!pair.isValid && <span className="leak-tag mono">invalid</span>}
              </div>
              <div className="panel-rows">
                <div className="panel-row">
                  <span className="mono dim">underlying</span>
                  <span className="mono">{pair.underlyingName.toLowerCase()}</span>
                </div>
                <div className="panel-row">
                  <span className="mono dim">wrapper</span>
                  <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="addr-inline">{pair.wrapper}</span>
                    <CopyButton value={pair.wrapper} label="copy" />
                  </span>
                </div>
                <div className="panel-row">
                  <span className="mono dim">rate</span>
                  <span className="mono">1 : {pair.rate.toString()}</span>
                </div>
                <div className="panel-row">
                  <span className="mono dim">your sealed balance</span>
                  <span className="mono">
                    {balance === null ? (
                      <span className="rbar wide" />
                    ) : (
                      `${wrapperBalanceToUnderlying(balance, pair)} ${pair.underlyingSymbol.toLowerCase()}`
                    )}
                  </span>
                </div>
              </div>
              {balance === null && (
                <button className="cta-box small" onClick={revealRegistry} disabled={!!busy}>
                  <span>{busy ? "decrypting..." : "decrypt my balance"}</span>
                  {!busy && <span className="cta-arrow">→</span>}
                </button>
              )}
            </div>
          )}

          {unknownToken && (
            <div className="panel" style={{ marginTop: 22 }}>
              <div className="panel-h">
                <span className="panel-sym">{unknownToken.symbol.toLowerCase()}</span>
                <span className="quiet-chip mono" style={{ marginLeft: "auto" }}>outside the registry</span>
              </div>
              <div className="panel-rows">
                <div className="panel-row">
                  <span className="mono dim">token</span>
                  <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="addr-inline">{unknownToken.address}</span>
                    <CopyButton value={unknownToken.address} label="copy" />
                  </span>
                </div>
                <div className="panel-row">
                  <span className="mono dim">decimals</span>
                  <span className="mono">{unknownToken.decimals}</span>
                </div>
                <div className="panel-row">
                  <span className="mono dim">your sealed balance</span>
                  <span className="mono">
                    {balance === null ? (
                      <span className="rbar wide" />
                    ) : (
                      `${fmtUnknown(balance, unknownToken.decimals)} ${unknownToken.symbol.toLowerCase()}`
                    )}
                  </span>
                </div>
              </div>
              <p className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.1em", margin: "10px 0" }}>
                this token is not in the zama registry. metadata was read from the contract itself. decrypt
                still works because the EIP-712 user decryption flow only needs the token address and your signature.
              </p>
              {balance === null && (
                <button className="cta-box small" onClick={revealUnknown} disabled={!!busy}>
                  <span>{busy ? "decrypting..." : "decrypt my balance"}</span>
                  {!busy && <span className="cta-arrow">→</span>}
                </button>
              )}
            </div>
          )}

          {busy && !pair && !unknownToken && (
            <p className="mono dim" style={{ marginTop: 16 }}><span className="spin" /> {busy}</p>
          )}
        </div>
      )}

      {error && <div className="err-bar mono">{error}</div>}
    </main>
  );
}
