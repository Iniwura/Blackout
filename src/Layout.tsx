import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import SideMarkers from "./components/SideMarkers";

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14" aria-hidden="true">
      {open ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}

function IconBurger({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
      {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 8h16M4 16h16" />}
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    setBurgerOpen(false);
  }, [location.pathname]);

  // Close "more" dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".more-wrap")) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [moreOpen]);

  return (
    <div className="viewport">
      <SideMarkers left="PUBLIC BY DEFAULT IS A BUG" right="TAKE YOUR BALANCE DARK" />

      <div className="frame">
        <header className="topbar">
          <NavLink to="/" className="brand" end>
            <div className="brand-shape" aria-hidden="true" />
            <span className="brand-word">BLACKOUT</span>
          </NavLink>

          <nav className="topnav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/vault">Vault</NavLink>
            <NavLink to="/portfolio">Portfolio</NavLink>
            <NavLink to="/feed">Feed</NavLink>
            <div className="more-wrap">
              <button
                className="more-btn"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                More <IconChevron open={moreOpen} />
              </button>
              {moreOpen && (
                <div className="more-menu" role="menu">
                  <NavLink to="/registry" role="menuitem">Registry</NavLink>
                  <NavLink to="/faucet" role="menuitem">Faucet</NavLink>
                  <NavLink to="/reveal" role="menuitem">Reveal any token</NavLink>
                </div>
              )}
            </div>
          </nav>

          <div className="top-actions">
            <div className="connect-shell">
              <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
            </div>
            <button
              className="burger"
              onClick={() => setBurgerOpen((v) => !v)}
              aria-expanded={burgerOpen}
              aria-label={burgerOpen ? "Close menu" : "Open menu"}
            >
              <IconBurger open={burgerOpen} />
            </button>
          </div>
        </header>

        {burgerOpen && (
          <div className="mobile-panel">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/vault">Vault</NavLink>
            <NavLink to="/portfolio">Portfolio</NavLink>
            <NavLink to="/feed">Feed</NavLink>
            <div className="mobile-divider" />
            <NavLink to="/registry">Registry</NavLink>
            <NavLink to="/faucet">Faucet</NavLink>
            <NavLink to="/reveal">Reveal any token</NavLink>
          </div>
        )}

        <div className="page-swap" key={location.pathname}>
          <Outlet />
        </div>

        <div className="bottom-marquee" aria-hidden="true">
          <div className="bmq-track mono">
            <span>BLACKOUT · PUBLIC BY DEFAULT IS A BUG · GO DARK ·&nbsp;</span>
            <span>BLACKOUT · PUBLIC BY DEFAULT IS A BUG · GO DARK ·&nbsp;</span>
            <span>BLACKOUT · PUBLIC BY DEFAULT IS A BUG · GO DARK ·&nbsp;</span>
            <span>BLACKOUT · PUBLIC BY DEFAULT IS A BUG · GO DARK ·&nbsp;</span>
          </div>
        </div>
      </div>

      <div className="outer-tag mono" aria-hidden="true">
        ERC-20 ↔ ERC-7984 · POWERED BY ZAMA FHEVM · SEPOLIA
      </div>
    </div>
  );
}
