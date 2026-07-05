import { useEffect, useMemo, useState } from "react";
import { fetchAllPairs, MOCK_UNDERLYINGS, RESTRICTED_UNDERLYINGS, REGISTRY_ADDRESS, type PairInfo } from "../lib";
import CopyButton from "../components/CopyButton";

function fmtTVS(tvs: bigint, dec: number, sym: string): string {
  if (tvs === 0n) return "0";
  const raw = Number(tvs) / 10 ** dec;
  if (raw >= 1e6) return `${(raw / 1e6).toFixed(2)}M ${sym.toLowerCase()}`;
  if (raw >= 1e3) return `${(raw / 1e3).toFixed(2)}K ${sym.toLowerCase()}`;
  return `${raw.toLocaleString()} ${sym.toLowerCase()}`;
}

function classifyPair(p: PairInfo, dupSymbols: Set<string>): {
  status: "valid" | "revoked" | "unknown";
  badges: { label: string; kind: "warn" | "danger" | "info" }[];
} {
  const badges: { label: string; kind: "warn" | "danger" | "info" }[] = [];
  const key = p.underlying.toLowerCase();
  const known = key in MOCK_UNDERLYINGS || RESTRICTED_UNDERLYINGS.includes(key);
  if (!p.isValid) badges.push({ label: "revoked", kind: "danger" });
  if (!known) badges.push({ label: "unknown", kind: "info" });
  if (dupSymbols.has(p.underlyingSymbol.toLowerCase())) badges.push({ label: "dup symbol", kind: "warn" });
  return {
    status: !p.isValid ? "revoked" : !known ? "unknown" : "valid",
    badges,
  };
}

export default function Registry() {
  const [pairs, setPairs] = useState<PairInfo[] | null>(null);
  const [filter, setFilter] = useState<"all" | "valid" | "revoked">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchAllPairs();
        if (!cancelled) setPairs(p);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dupSymbols = useMemo(() => {
    if (!pairs) return new Set<string>();
    const counts: Record<string, number> = {};
    pairs.forEach((p) => {
      const s = p.underlyingSymbol.toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return new Set(Object.entries(counts).filter(([, n]) => n > 1).map(([s]) => s));
  }, [pairs]);

  const filtered = useMemo(() => {
    if (!pairs) return null;
    let list = pairs;
    if (filter === "valid") list = list.filter((p) => p.isValid);
    else if (filter === "revoked") list = list.filter((p) => !p.isValid);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.underlyingSymbol.toLowerCase().includes(q) ||
        p.wrapperSymbol.toLowerCase().includes(q) ||
        p.underlyingName.toLowerCase().includes(q) ||
        p.underlying.toLowerCase().includes(q) ||
        p.wrapper.toLowerCase().includes(q),
      );
    }
    return list;
  }, [pairs, filter, search]);

  return (
    <main className="page">
      <section className="page-head">
        <p className="eyebrow mono">[ REGISTRY ]</p>
        <h1 className="page-h">
          <span>every pair on record.</span>
          <span className="mega-outline">valid, revoked, flagged.</span>
        </h1>
        <p className="page-copy">
          Live from the Zama Wrappers Registry on Sepolia. Revoked pairs are shown greyed with a badge so the
          history is visible. Duplicate underlying symbols are flagged. Unknown metadata gets a review tag.
        </p>
        <p className="page-copy" style={{ marginTop: 14, fontSize: 13 }}>
          <span className="mono dim">registry</span>{" "}
          <span className="mono">{REGISTRY_ADDRESS}</span>{" "}
          <CopyButton value={REGISTRY_ADDRESS} label="copy" />{" "}
          <a
            className="link-inline"
            href={`https://sepolia.etherscan.io/address/${REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            etherscan
          </a>
        </p>
      </section>

      <div className="control-row" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="xray-toggle" role="tablist" aria-label="filter registry">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>all</button>
            <button className={filter === "valid" ? "active" : ""} onClick={() => setFilter("valid")}>valid</button>
            <button className={filter === "revoked" ? "active" : ""} onClick={() => setFilter("revoked")}>revoked</button>
          </div>
          <input
            className="search-input mono"
            type="text"
            placeholder="search symbol, name, or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {pairs && (
          <p className="mono dim" style={{ fontSize: 12, letterSpacing: "0.16em" }}>
            showing {filtered?.length ?? 0} of {pairs.length}
          </p>
        )}
      </div>

      <section className="table-block wide">
        {!filtered ? (
          <p className="mono dim"><span className="spin" /> reading the registry...</p>
        ) : filtered.length === 0 ? (
          <p className="mono dim" style={{ padding: 40, textAlign: "center" }}>
            no pairs match. clear the search or switch filters.
          </p>
        ) : (
          <table className="pos-table wide">
            <thead>
              <tr>
                <th className="mono">underlying</th>
                <th className="mono">confidential</th>
                <th className="mono">rate</th>
                <th className="mono">supply</th>
                <th className="mono">wrapper</th>
                <th className="mono">status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const cls = classifyPair(p, dupSymbols);
                return (
                  <tr key={p.wrapper} className={cls.status === "revoked" ? "row-invalid" : ""}>
                    <td>
                      <span className="mono row-idx">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="row-sym">{p.underlyingSymbol.toLowerCase()}</span>
                      <span className="mono dim row-arrow">{p.underlyingName.toLowerCase()}</span>
                    </td>
                    <td>
                      <span className="row-sym">{p.wrapperSymbol.toLowerCase()}</span>{" "}
                      <span className="mono dim">({p.wrapperDecimals}dp)</span>
                    </td>
                    <td className="mono">1 : {p.rate.toString()}</td>
                    <td className="mono">{fmtTVS(p.tvs, p.underlyingDecimals, p.underlyingSymbol)}</td>
                    <td>
                      <span className="mono dim addr-inline">{p.wrapper.slice(0, 8)}…{p.wrapper.slice(-6)}</span>{" "}
                      <CopyButton value={p.wrapper} label="copy" />
                    </td>
                    <td>
                      {cls.badges.length === 0 ? (
                        <span className="status-dark mono">valid</span>
                      ) : (
                        <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                          {cls.badges.map((b) => (
                            <span
                              key={b.label}
                              className={`badge mono badge-${b.kind}`}
                              title={
                                b.label === "revoked"
                                  ? "this pair was revoked by the registry admin; wrap and unwrap should not be used"
                                  : b.label === "unknown"
                                  ? "this pair is not in the app's known list; metadata came from the wrapper directly"
                                  : b.label === "dup symbol"
                                  ? "another pair shares this underlying symbol; check the address to identify the correct one"
                                  : ""
                              }
                            >
                              {b.label}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>
                      <a
                        className="foot-link mono"
                        href={`https://sepolia.etherscan.io/address/${p.wrapper}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        etherscan ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
