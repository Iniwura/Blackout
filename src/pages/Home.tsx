import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { fetchAllPairs, type PairInfo } from "../lib";
import HeroVisual from "../components/HeroVisual";

function useScrambleOnMount(target: number, ms = 900): string {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    const start = performance.now();
    const chars = "0123456789";
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const finalStr = String(target);
      const len = finalStr.length;
      const revealed = Math.floor(eased * len);
      const scrambled =
        finalStr.slice(0, revealed) +
        Array.from({ length: len - revealed }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      setDisplay(scrambled);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return display;
}

function Stat({ n, label, delayMs = 0 }: { n: number; label: string; delayMs?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
  const shown = useScrambleOnMount(ready ? n : 0);
  return (
    <div className="ministat">
      <span className="ministat-n">{shown || "0"}</span>
      <span className="ministat-l mono">{label}</span>
    </div>
  );
}

export default function Home() {
  const [pairs, setPairs] = useState<PairInfo[] | null>(null);
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

  const valid = pairs?.filter((p) => p.isValid).length ?? 0;

  return (
    <main className="home">
      <section className="split">
        <div className="split-left">
          <p className="eyebrow mono anim-fade-up" style={{ animationDelay: "0.1s" }}>
            [ CONFIDENTIAL WRAPPER . SEPOLIA ]
          </p>
          <h1 className="mega">
            <span className="anim-fade-up" style={{ animationDelay: "0.25s", display: "block" }}>
              your balance
            </span>
            <span className="mega-outline anim-fade-up" style={{ animationDelay: "0.45s", display: "block" }}>
              your balance
            </span>
            <span className="mega-strike anim-fade-up" style={{ animationDelay: "0.65s", display: "block" }}>
              your balance.
            </span>
          </h1>
          <p className="hero-copy anim-fade-up" style={{ animationDelay: "0.9s" }}>
            Every ERC-20 in your wallet is broadcasting how much you hold to anyone with an internet connection.
            BLACKOUT swaps them for confidential wrappers. Same tokens, sealed amounts.
          </p>
          <div className="hero-cta-row anim-fade-up" style={{ animationDelay: "1.1s" }}>
            <Link to="/vault" className="cta-box">
              <span>Take yours dark</span>
              <span className="cta-arrow" aria-hidden="true">→</span>
            </Link>
            <Link to="/registry" className="cta-plain">Browse pairs</Link>
          </div>
        </div>

        <div className="split-right anim-fade-in" style={{ animationDelay: "0.6s" }}>
          <HeroVisual />
        </div>
      </section>

      <section className="mini-strip anim-fade-up" style={{ animationDelay: "1.3s" }}>
        <Stat n={valid || 8} label="ACTIVE PAIRS" delayMs={1400} />
        <Stat n={7} label="MOCK FAUCETS" delayMs={1550} />
        <Stat n={100} label="% SEALED . UNDER FHE" delayMs={1700} />
      </section>

      <section className="pillar-row">
        <ScrollReveal delay={0}>
          <div className="pillar">
            <span className="pillar-k mono">01</span>
            <h3 className="pillar-h">Public.</h3>
            <p className="pillar-p">
              The default nobody chose. Standard ERC-20 balances are readable by every explorer,
              indexer, and analytics bot. If you hold it, everyone knows the number.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={120}>
          <div className="pillar">
            <span className="pillar-k mono">02</span>
            <h3 className="pillar-h">Sealed.</h3>
            <p className="pillar-p">
              ERC-7984 confidential wrappers store your amount as an FHE ciphertext. Onchain, in your
              wallet, but sealed to everyone except the address that owns it.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={240}>
          <div className="pillar">
            <span className="pillar-k mono">03</span>
            <h3 className="pillar-h">Yours.</h3>
            <p className="pillar-p">
              Only your signature can decrypt your own balance. Not us. Not the operator. Not the KMS
              signers acting alone. You hold the key.
            </p>
          </div>
        </ScrollReveal>
      </section>

      <section className="walkthrough">
        <ScrollReveal>
          <div className="walkthrough-head">
            <p className="mono eyebrow">[ HOW IT WORKS ]</p>
            <h2 className="walkthrough-h">Public to private in five steps.</h2>
            <p className="walkthrough-sub">
              A guided tour through what BLACKOUT actually does. Each step is a real page you can use right now.
              Bring a Sepolia wallet and end up with a portfolio the chain cannot read.
            </p>
          </div>
        </ScrollReveal>
        <div className="walkthrough-grid">
          {[
            {
              n: "01",
              t: "Fund the wallet",
              d: "Mint mock underlyings from the built-in faucet. Every cToken has a corresponding ERC-20 with a public mint. No forms, no rate limits, no gas beyond your Sepolia ETH.",
              to: "/faucet",
            },
            {
              n: "02",
              t: "Wrap your balance",
              d: "Enter an amount in the USDC panel. Wrap turns your public balance into an encrypted cUSDC handle. The world sees a ciphertext.",
              to: "/vault",
            },
            {
              n: "03",
              t: "Reveal only for you",
              d: "Click decrypt, sign the EIP-712 message. Your browser decrypts the balance locally. The chain never learned what you saw.",
              to: "/vault",
            },
            {
              n: "04",
              t: "Measure the difference",
              d: "The portfolio scores every position from 0 to 100 percent based on how much is sealed. It also flags leaking, mixed, and fully dark tokens so you know exactly where you stand.",
              to: "/portfolio",
            },
            {
              n: "05",
              t: "See it on the chain",
              d: "The surveillance feed shows recent transfers across every registered pair. Public transactions expose the full amount. Wraps and confidential moves show sealed. Same block, radically different privacy.",
              to: "/feed",
            },
          ].map((s, i) => (
            <ScrollReveal delay={i * 80} key={s.n}>
              <Link to={s.to} className="wstep">
                <span className="wstep-n mono">{s.n}</span>
                <span className="wstep-body">
                  <span className="wstep-t">{s.t}</span>
                  <span className="wstep-d">{s.d}</span>
                </span>
                <span className="wstep-arrow" aria-hidden="true">→</span>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="closer">
        <ScrollReveal>
          <div className="closer-inner">
            <p className="mono closer-eyebrow">[ THE MOVE ]</p>
            <h2 className="closer-h">
              <span>public by default</span>
              <span className="closer-h-flip">is a bug.</span>
            </h2>
            <Link to="/vault" className="cta-box">
              <span>Open the vault</span>
              <span className="cta-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}

function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.setTimeout(() => setShown(true), delay);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`sr ${shown ? "sr-in" : ""}`}>
      {children}
    </div>
  );
}
