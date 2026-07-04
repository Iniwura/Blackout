import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import CopyButton from "../components/CopyButton";
import {
  fetchAllPairs, getUnderlyingBalance, wrap, decryptMyBalance,
  requestUnwrap, finalizeUnwrap, faucet,
  formatUnderlying, wrapperBalanceToUnderlying, parseUnderlying, parseAsWrapperUnits,
  shortAddr,
  type PairInfo,
} from "../lib";

type XRay = "yours" | "world";

export default function Vault() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [pubBalances, setPubBalances] = useState<Record<string, bigint>>({});
  const [confBalances, setConfBalances] = useState<Record<string, bigint | null>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [xray, setXray] = useState<XRay>("yours");
  const [goingDark, setGoingDark] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const all = await fetchAllPairs();
    setPairs(all);
    if (!address) return;
    const pubs: Record<string, bigint> = {};
    await Promise.all(all.map(async (p) => {
      pubs[p.underlying] = await getUnderlyingBalance(p.underlying, address).catch(() => 0n);
    }));
    setPubBalances(pubs);
  }, [address]);

  useEffect(() => { void load(); }, [load]);

  async function unmask(pair: PairInfo) {
    if (!address || !walletClient) return;
    setBusy((b) => ({ ...b, [pair.wrapper]: "sign to reveal" }));
    try {
      const clear = await decryptMyBalance(walletClient, address, pair.wrapper);
      setConfBalances((c) => ({ ...c, [pair.wrapper]: clear }));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy((b) => ({ ...b, [pair.wrapper]: "" }));
    }
  }

  async function doWrap(pair: PairInfo) {
    if (!address || !walletClient) return;
    const raw = amounts[pair.wrapper];
    if (!raw) return setError("enter an amount to wrap");
    setError("");
    try {
      const amt = parseUnderlying(raw, pair.underlyingDecimals);
      setBusy((b) => ({ ...b, [pair.wrapper]: "wrapping..." }));
      await wrap(walletClient, address, pair, amt, (msg) =>
        setBusy((b) => ({ ...b, [pair.wrapper]: msg.toLowerCase() })));
      setAmounts((a) => ({ ...a, [pair.wrapper]: "" }));
      await load();
      setConfBalances((c) => ({ ...c, [pair.wrapper]: null }));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy((b) => ({ ...b, [pair.wrapper]: "" }));
    }
  }

  async function doUnwrap(pair: PairInfo) {
    if (!address || !walletClient) return;
    const raw = amounts[pair.wrapper];
    if (!raw) return setError("enter an amount to unwrap");
    setError("");
    try {
      const amt = parseAsWrapperUnits(raw, pair.wrapperDecimals);
      setBusy((b) => ({ ...b, [pair.wrapper]: "requesting unwrap..." }));
      const { requestId } = await requestUnwrap(walletClient, address, pair, amt);
      setBusy((b) => ({ ...b, [pair.wrapper]: "finalizing with kms proof..." }));
      await finalizeUnwrap(walletClient, address, pair, requestId);
      setAmounts((a) => ({ ...a, [pair.wrapper]: "" }));
      await load();
      setConfBalances((c) => ({ ...c, [pair.wrapper]: null }));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy((b) => ({ ...b, [pair.wrapper]: "" }));
    }
  }

  async function goDark() {
    if (!address || !walletClient) return;
    setGoingDark(true);
    setError("");
    try {
      const active = pairs.filter((p) => p.isValid && (pubBalances[p.underlying] ?? 0n) > 0n);
      for (const pair of active) {
        const bal = pubBalances[pair.underlying];
        setBusy((b) => ({ ...b, [pair.wrapper]: `wrapping ${pair.underlyingSymbol.toLowerCase()}...` }));
        await wrap(walletClient, address, pair, bal);
        setConfBalances((c) => ({ ...c, [pair.wrapper]: null }));
      }
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy({});
      setGoingDark(false);
    }
  }

  async function useFaucet(pair: PairInfo) {
    if (!address || !walletClient || !pair.isFaucetable) return;
    setError("");
    try {
      setBusy((b) => ({ ...b, [pair.wrapper]: `minting 100 ${pair.underlyingSymbol.toLowerCase()}...` }));
      const amt = parseUnderlying("100", pair.underlyingDecimals);
      await faucet(walletClient, address, pair.underlying, amt);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy((b) => ({ ...b, [pair.wrapper]: "" }));
    }
  }

  const active = pairs.filter((p) => p.isValid);
  const anyLeaking = pairs.some((p) => (pubBalances[p.underlying] ?? 0n) > 0n);

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ VAULT ]</p>
        <h1 className="page-h">
          <span>your positions.</span>
          <span className="mega-outline">every token, every side.</span>
        </h1>
        <p className="page-copy">
          Each panel is a pair from the registry. Left of the arrow is public. The whole chain sees it. Right is sealed. Only your signature reads it. Wrap to seal. Unwrap to withdraw.
        </p>
      </section>

      {!isConnected ? (
        <div className="empty-shell">
          <p className="empty-msg">connect a wallet to see your positions</p>
        </div>
      ) : (
        <>
          <div className="control-row">
            <div className="xray-toggle" role="tablist" aria-label="view mode">
              <button className={xray === "yours" ? "active" : ""} onClick={() => setXray("yours")}>your view</button>
              <button className={xray === "world" ? "active" : ""} onClick={() => setXray("world")}>what the world sees</button>
            </div>
            {anyLeaking && (
              <button className="cta-box small" onClick={goDark} disabled={goingDark}>
                <span>{goingDark ? "going dark..." : "go dark on everything"}</span>
                {!goingDark && <span className="cta-arrow">→</span>}
              </button>
            )}
          </div>

          {active.length === 0 && (
            <div className="empty-shell">
              <p className="empty-msg"><span className="spin" /> loading pairs...</p>
            </div>
          )}

          <div className="panel-grid">
            {active.map((pair) => {
              const pub = pubBalances[pair.underlying] ?? 0n;
              const conf = confBalances[pair.wrapper];
              const status = busy[pair.wrapper];
              const leaking = pub > 0n;
              return (
                <div className="panel" key={pair.wrapper}>
                  <div className="panel-h">
                    <span className="panel-sym">{pair.underlyingSymbol.toLowerCase()}</span>
                    <span className="panel-x">↔</span>
                    <span className="panel-sym-mono">{pair.wrapperSymbol.toLowerCase()}</span>
                    {leaking && <span className="leak-tag mono">leaking</span>}
                  </div>

                  <div className="panel-rows">
                    <div className="panel-row">
                      <span className="mono dim">public</span>
                      <span className={`mono ${leaking ? "danger" : "dim"}`}>
                        {formatUnderlying(pub, pair)} {pair.underlyingSymbol.toLowerCase()}
                      </span>
                    </div>
                    <div className="panel-row">
                      <span className="mono dim">sealed</span>
                      <span className="mono">
                        {xray === "world" ? (
                          <span className="rbar wide" />
                        ) : conf === undefined || conf === null ? (
                          <button
                            className="link-inline"
                            onClick={() => unmask(pair)}
                            disabled={!!status}
                          >
                            reveal ↗
                          </button>
                        ) : (
                          `${wrapperBalanceToUnderlying(conf, pair)} ${pair.underlyingSymbol.toLowerCase()}`
                        )}
                      </span>
                    </div>
                  </div>

                  <input
                    className="amount-input mono"
                    type="text"
                    inputMode="decimal"
                    placeholder={`amount in ${pair.underlyingSymbol.toLowerCase()}`}
                    value={amounts[pair.wrapper] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [pair.wrapper]: e.target.value }))}
                    disabled={!!status}
                  />
                  <div className="panel-actions">
                    <button className="inline-btn primary" onClick={() => doWrap(pair)} disabled={!!status}>wrap</button>
                    <button className="inline-btn ghost" onClick={() => doUnwrap(pair)} disabled={!!status}>unwrap</button>
                  </div>

                  <div className="panel-foot mono">
                    {pair.isFaucetable && (
                      <button className="foot-link" onClick={() => useFaucet(pair)} disabled={!!status}>
                        + faucet 100
                      </button>
                    )}
                    <span className="foot-addr">
                      <a
                        className="foot-link"
                        href={`https://sepolia.etherscan.io/address/${pair.wrapper}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddr(pair.wrapper)} ↗
                      </a>
                      <CopyButton value={pair.wrapper} label="copy" />
                    </span>
                  </div>

                  {status && (
                    <div className="foot-status mono">
                      <span className="spin" />
                      {status}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {error && <div className="err-bar mono">{error}</div>}
    </main>
  );
}
