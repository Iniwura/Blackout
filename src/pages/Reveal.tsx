import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import CopyButton from "../components/CopyButton";
import {
  fetchPairForWrapper, decryptMyBalance, wrapperBalanceToUnderlying,
  type PairInfo,
} from "../lib";

export default function Reveal() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [input, setInput] = useState("");
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function lookup() {
    setError("");
    setPair(null);
    setBalance(null);
    if (!/^0x[a-fA-F0-9]{40}$/.test(input.trim())) {
      return setError("that isn't a valid ethereum address");
    }
    try {
      setBusy("looking up in the registry...");
      const p = await fetchPairForWrapper(input.trim() as Address);
      if (!p) {
        setError("this address is not a registered ERC-7984 wrapper on sepolia");
        return;
      }
      setPair(p);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy("");
    }
  }

  async function reveal() {
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

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ REVEAL ANY ]</p>
        <h1 className="page-h">
          <span>paste an address.</span>
          <span className="mega-outline">read your sealed balance.</span>
        </h1>
        <p className="page-copy">
          Not sure your ERC-7984 wrapper is in the Vault? Paste it here. We check the registry, confirm it is a legitimate confidential token, then let you decrypt <em>your</em> balance on it. Only your signature opens it. Same guarantee as everywhere else in this app.
        </p>
      </section>

      {!isConnected ? (
        <div className="empty-shell">
          <p className="empty-msg">connect a wallet to reveal a sealed balance</p>
        </div>
      ) : (
        <div className="reveal-block">
          <div className="reveal-label mono">wrapper address</div>
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
                <button className="cta-box small" onClick={reveal} disabled={!!busy}>
                  <span>{busy ? "revealing..." : "reveal my balance"}</span>
                  {!busy && <span className="cta-arrow">→</span>}
                </button>
              )}
            </div>
          )}

          {busy && !pair && (
            <p className="mono dim" style={{ marginTop: 16 }}><span className="spin" /> {busy}</p>
          )}
        </div>
      )}

      {error && <div className="err-bar mono">{error}</div>}
    </main>
  );
}
