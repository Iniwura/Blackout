import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import CopyButton from "../components/CopyButton";
import {
  fetchAllPairs, faucet, getUnderlyingBalance,
  parseUnderlying, formatUnderlying,
  type PairInfo,
} from "../lib";

export default function Faucet() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [balances, setBalances] = useState<Record<Address, bigint>>({} as Record<Address, bigint>);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const all = await fetchAllPairs();
    setPairs(all);
    if (!address) return;
    const balMap = {} as Record<Address, bigint>;
    await Promise.all(all.map(async (p) => {
      balMap[p.underlying] = await getUnderlyingBalance(p.underlying, address).catch(() => 0n);
    }));
    setBalances(balMap);
  }, [address]);

  useEffect(() => { void load(); }, [load]);

  async function mint(pair: PairInfo, howMany: number) {
    if (!address || !walletClient) return;
    setError("");
    try {
      setBusy((b) => ({ ...b, [pair.underlying]: `minting ${howMany} ${pair.underlyingSymbol.toLowerCase()}...` }));
      const amt = parseUnderlying(String(howMany), pair.underlyingDecimals);
      await faucet(walletClient, address, pair.underlying, amt);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy((b) => ({ ...b, [pair.underlying]: "" }));
    }
  }

  const faucetable = pairs.filter((p) => p.isFaucetable && p.isValid);
  const restricted = pairs.filter((p) => p.isValid && !p.isFaucetable);

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ FAUCET ]</p>
        <h1 className="page-h">
          <span>free test tokens.</span>
          <span className="mega-outline">no forms, just mint.</span>
        </h1>
        <p className="page-copy">
          Every mock underlying exposes a public <code className="mono">mint()</code> up to a million per call.
          Pick a token, hit a button, wrap it in the Vault.
        </p>
      </section>

      {!isConnected ? (
        <div className="empty-shell">
          <p className="empty-msg">connect a wallet to use the faucet</p>
        </div>
      ) : (
        <>
          <div className="panel-grid">
            {faucetable.map((pair) => {
              const bal = balances[pair.underlying] ?? 0n;
              const status = busy[pair.underlying];
              return (
                <div className="panel" key={pair.underlying}>
                  <div className="panel-h">
                    <span className="panel-sym">{pair.underlyingSymbol.toLowerCase()}</span>
                    <span className="mono dim" style={{ fontSize: 11 }}>{pair.underlyingName.toLowerCase()}</span>
                  </div>
                  <div className="panel-rows">
                    <div className="panel-row">
                      <span className="mono dim">balance</span>
                      <span className="mono">
                        {formatUnderlying(bal, pair)} {pair.underlyingSymbol.toLowerCase()}
                      </span>
                    </div>
                    <div className="panel-row">
                      <span className="mono dim">decimals</span>
                      <span className="mono">{pair.underlyingDecimals}</span>
                    </div>
                    <div className="panel-row">
                      <span className="mono dim">contract</span>
                      <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>{pair.underlying.slice(0, 8)}…{pair.underlying.slice(-6)}</span>
                        <CopyButton value={pair.underlying} label="copy" />
                      </span>
                    </div>
                  </div>
                  <p className="mono dim" style={{ fontSize: 10, letterSpacing: "0.16em", marginTop: 4 }}>
                    test token. not real {pair.underlyingSymbol.toLowerCase()}.
                  </p>
                  <div className="panel-actions">
                    <button className="inline-btn primary" onClick={() => mint(pair, 100)} disabled={!!status}>+ 100</button>
                    <button className="inline-btn ghost" onClick={() => mint(pair, 1000)} disabled={!!status}>+ 1,000</button>
                  </div>
                  {status && (
                    <div className="foot-status mono">
                      <span className="spin" />{status}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {restricted.length > 0 && (
            <section className="restricted-block">
              <p className="mono eyebrow" style={{ marginBottom: 12 }}>[ restricted mint ]</p>
              <p className="mono dim" style={{ fontSize: 13, marginBottom: 16 }}>
                these underlyings don't expose a public mint. available via other zama channels.
              </p>
              <div className="chip-row">
                {restricted.map((p) => (
                  <span className="quiet-chip mono" key={p.underlying}>
                    {p.underlyingSymbol.toLowerCase()} ↔ {p.wrapperSymbol.toLowerCase()}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {error && <div className="err-bar mono">{error}</div>}
    </main>
  );
}
