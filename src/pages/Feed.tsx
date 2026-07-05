import { useEffect, useMemo, useState } from "react";
import { fetchAllPairs, fetchRecentFeed, displayAmount, shortAddr, type FeedEvent, type PairInfo } from "../lib";

export default function Feed() {
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchAllPairs();
        if (cancelled) return;
        setPairs(p);
        const feed = await fetchRecentFeed(p, 40);
        if (!cancelled) setEvents(feed);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!events) return null;
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      e.pair.underlyingSymbol.toLowerCase().includes(q) ||
      e.pair.wrapperSymbol.toLowerCase().includes(q) ||
      (e.from || "").toLowerCase().includes(q) ||
      (e.to || "").toLowerCase().includes(q) ||
      e.txHash.toLowerCase().includes(q),
    );
  }, [events, search]);
  const publicCount = events?.filter((e) => e.kind === "public-transfer").length ?? 0;
  const sealedCount = events?.filter((e) => e.kind !== "public-transfer").length ?? 0;

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ FEED ]</p>
        <h1 className="page-h">
          <span>surveillance feed.</span>
          <span className="mega-outline">public leaks vs sealed moves.</span>
        </h1>
        <p className="page-copy">
          Recent Transfer, Wrap and ConfidentialTransfer events across every registered pair. Public transfers show the amount. The chain broadcasts them. Sealed movements show as{" "}
          <span className="mono danger">[SEALED]</span>. Same block, two very different levels of privacy.
        </p>
      </section>

      <div className="control-row" style={{ marginTop: 20, marginBottom: 20 }}>
        <input
          className="search-input mono"
          type="text"
          placeholder="search symbol, address, or tx hash"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 480 }}
        />
      </div>

      <div className="mini-strip" style={{ marginTop: 20 }}>
        <div className="ministat">
          <span className="ministat-n" style={{ color: "var(--danger)" }}>{events ? publicCount : "..."}</span>
          <span className="ministat-l mono">PUBLIC TRANSFERS · LEAKED</span>
        </div>
        <div className="ministat">
          <span className="ministat-n">{events ? sealedCount : "..."}</span>
          <span className="ministat-l mono">SEALED MOVES</span>
        </div>
        <div className="ministat">
          <span className="ministat-n">{pairs.filter((p) => p.isValid).length}</span>
          <span className="ministat-l mono">PAIRS MONITORED</span>
        </div>
      </div>

      <section className="table-block" style={{ marginTop: 40 }}>
        {!events ? (
          <p className="mono dim"><span className="spin" /> scanning ~2 weeks of sepolia blocks...</p>
        ) : events.length === 0 ? (
          <p className="mono dim">no recent activity. move some tokens through the vault to fill this.</p>
        ) : (
          <div className="feed-list">
            {(filtered ?? events).map((e, i) => (
              <div className="feed-row" key={`${e.txHash}-${i}`}>
                <span className={`feed-tag mono ${e.kind === "public-transfer" ? "leak" : "seal"}`}>
                  {e.kind === "public-transfer" ? "leak" : e.kind === "wrap" ? "wrap" : "sealed"}
                </span>
                <div className="feed-desc mono">
                  <span className="row-sym">{e.pair.underlyingSymbol.toLowerCase()}</span>{" "}
                  <span className="dim">{e.kind === "public-transfer" ? "↔" : "→"}</span>{" "}
                  <span className="row-sym">{e.pair.wrapperSymbol.toLowerCase()}</span>
                  <br />
                  <span className="dim" style={{ fontSize: 11 }}>
                    {shortAddr(e.from)} → {shortAddr(e.to)} · block {e.blockNumber.toString()}
                  </span>
                </div>
                <span className={`feed-amt mono ${e.kind === "public-transfer" ? "danger" : "sealed"}`}>
                  {e.kind === "public-transfer" ? displayAmount(e.amount, e.pair) : "[ sealed ]"}
                  <a
                    className="feed-explorer mono"
                    href={`https://sepolia.etherscan.io/tx/${e.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    title="View on Sepolia Etherscan"
                  >
                    view ↗
                  </a>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <div className="err-bar mono">{error}</div>}
    </main>
  );
}
