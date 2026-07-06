import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import CopyButton from "../components/CopyButton";
import {
  fetchAllPairs, getUnderlyingBalance, decryptMyBalance,
  privacyScore,
  formatUnderlying, wrapperBalanceToUnderlying,
  type PairInfo,
} from "../lib";

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [pubBalances, setPubBalances] = useState<Record<Address, bigint>>({} as Record<Address, bigint>);
  const [confBalances, setConfBalances] = useState<Record<Address, bigint | null>>({} as Record<Address, bigint | null>);
  const [hidden, setHidden] = useState(false);
  const [unmasking, setUnmasking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!address) return;
    const all = await fetchAllPairs();
    setPairs(all);
    const pubs = {} as Record<Address, bigint>;
    await Promise.all(all.map(async (p) => {
      pubs[p.underlying] = await getUnderlyingBalance(p.underlying, address).catch(() => 0n);
    }));
    setPubBalances(pubs);
  }, [address]);

  useEffect(() => { void load(); }, [load]);

  async function unmaskAll() {
    if (!address || !walletClient) return;
    setUnmasking(true);
    try {
      const next = {} as Record<Address, bigint | null>;
      for (const p of pairs.filter((x) => x.isValid)) {
        try {
          next[p.wrapper] = await decryptMyBalance(walletClient, address, p.wrapper);
        } catch {
          next[p.wrapper] = null;
        }
      }
      setConfBalances(next);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUnmasking(false);
    }
  }

  const { score, numerator, denominator } = privacyScore(pairs, pubBalances, confBalances);

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ PORTFOLIO ]</p>
        <h1 className="page-h">
          <span>wallet state.</span>
          <span className="mega-outline">how dark are you?</span>
        </h1>
        <p className="page-copy">
          A read of your positions across every registered pair. Public balances are always visible. Sealed balances require your signature to reveal. Click decrypt everything to score the whole book.
        </p>
      </section>

      {!isConnected ? (
        <div className="empty-shell">
          <p className="empty-msg">connect a wallet to see wallet state</p>
        </div>
      ) : (
        <>
          <div className="id-strip">
            <div className="id-block">
              <span className="mono id-k">wallet</span>
              <span className="id-val mono">
                {hidden ? <span className="rbar wide" /> : (
                  <>
                    <span className="addr-inline">{address}</span>
                    <CopyButton value={address!} label="copy" />
                  </>
                )}
              </span>
            </div>
            <button className="hide-btn mono" onClick={() => setHidden((v) => !v)}>
              {hidden ? "show ↗" : "hide ↗"}
            </button>
          </div>

          <section className="score-block">
            <div className="score-top">
              <div>
                <p className="mono score-eyebrow">[ privacy score ]</p>
                <p className="mono score-sub">
                  {denominator === 0 ? "no positions detected" : `${numerator} of ${denominator} positions sealed`}
                </p>
              </div>
              <button className="cta-box small" onClick={unmaskAll} disabled={unmasking}>
                <span>{unmasking ? "decrypting..." : "decrypt everything"}</span>
                {!unmasking && <span className="cta-arrow">→</span>}
              </button>
            </div>
            <div className="score-big">
              {hidden ? "??" : score}
              <span className="score-percent">%</span>
            </div>
            <div className="score-bar">
              <div className="score-fill" style={{ width: hidden ? "50%" : `${score}%` }} />
            </div>
            <div className="score-legend mono">
              <span>{hidden ? <span className="rbar" /> : `${numerator} dark`}</span>
              <span>{hidden ? <span className="rbar" /> : `${denominator} total positions`}</span>
            </div>
          </section>

          <section className="table-block">
            <h2 className="mono table-h">[ positions ]</h2>
            <table className="pos-table">
              <thead>
                <tr>
                  <th className="mono">token</th>
                  <th className="mono">public</th>
                  <th className="mono">sealed</th>
                  <th className="mono">status</th>
                </tr>
              </thead>
              <tbody>
                {pairs.filter((p) => p.isValid).map((p, idx) => {
                  const pub = pubBalances[p.underlying] ?? 0n;
                  const conf = confBalances[p.wrapper];
                  const dark = pub === 0n && conf !== undefined && conf !== null && conf > 0n;
                  const leaking = pub > 0n && (!conf || conf === 0n);
                  const mixed = pub > 0n && conf !== undefined && conf !== null && conf > 0n;
                  return (
                    <tr key={p.wrapper}>
                      <td>
                        <span className="mono row-idx">{String(idx + 1).padStart(2, "0")}</span>
                        <span className="row-sym">{p.underlyingSymbol.toLowerCase()}</span>
                        <span className="mono dim row-arrow">↔ {p.wrapperSymbol.toLowerCase()}</span>
                      </td>
                      <td className="mono">
                        {hidden ? <span className="rbar" /> : `${formatUnderlying(pub, p)} ${p.underlyingSymbol.toLowerCase()}`}
                      </td>
                      <td className="mono">
                        {hidden ? (
                          <span className="rbar" />
                        ) : conf === undefined ? (
                          <span className="dim">not read</span>
                        ) : conf === null ? (
                          <span className="danger">error</span>
                        ) : conf === 0n ? (
                          "0"
                        ) : (
                          `${wrapperBalanceToUnderlying(conf, p)} ${p.underlyingSymbol.toLowerCase()}`
                        )}
                      </td>
                      <td className="mono status-cell">
                        {dark ? <span className="status-dark">dark</span> :
                          leaking ? <span className="status-leak">leaking</span> :
                          mixed ? <span className="status-mix">mixed</span> :
                          <span className="dim">.</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {error && <div className="err-bar mono">{error}</div>}
    </main>
  );
}
