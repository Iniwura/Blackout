import { useEffect, useRef } from "react";

/**
 * Custom hero visual: a stream of "public" data particles on the left,
 * a sealed vault shape on the right, particles flow between them.
 * Cursor follows a soft glow. Pure SVG + refs, no external libraries.
 */
export default function HeroVisual() {
  const svgRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const glow = glowRef.current;
    if (!svg || !glow) return;
    const onMove = (e: MouseEvent) => {
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 800;
      const y = ((e.clientY - rect.top) / rect.height) * 600;
      glow.setAttribute("cx", String(Math.max(0, Math.min(800, x))));
      glow.setAttribute("cy", String(Math.max(0, Math.min(600, y))));
    };
    svg.addEventListener("mousemove", onMove);
    return () => svg.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 800 600"
      className="hero-visual"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Data particles flowing into a sealed vault"
    >
      <defs>
        <radialGradient id="cursor-glow">
          <stop offset="0%" stopColor="#e8e6df" stopOpacity="0.14" />
          <stop offset="60%" stopColor="#e8e6df" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#e8e6df" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stream" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff5555" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#e8e6df" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#e8e6df" stopOpacity="0" />
        </linearGradient>
        <filter id="soft-glow">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Ambient cursor-following glow */}
      <circle ref={glowRef} cx="400" cy="300" r="260" fill="url(#cursor-glow)" pointerEvents="none" />

      {/* Left column: raw public data (visible digits + values) */}
      <g className="hv-public" opacity="0.9">
        {[
          { x: 40, y: 100, t: "0x8a4f...c3d1" },
          { x: 40, y: 150, t: "value: 1,245.86 USDC" },
          { x: 40, y: 200, t: "0xbeef...ffff" },
          { x: 40, y: 250, t: "value: 89.4 WETH" },
          { x: 40, y: 300, t: "0xdead...0001" },
          { x: 40, y: 350, t: "value: 12,900 ZAMA" },
          { x: 40, y: 400, t: "0xfeed...abcd" },
          { x: 40, y: 450, t: "value: 314.15 XAUt" },
          { x: 40, y: 500, t: "0xcafe...babe" },
        ].map((r, i) => (
          <text
            key={i}
            x={r.x}
            y={r.y}
            fill="#ff5555"
            fontFamily="JetBrains Mono, monospace"
            fontSize="12"
            className="hv-line"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            {r.t}
          </text>
        ))}
      </g>

      {/* Flow lines from public into vault */}
      <g fill="none" stroke="url(#stream)" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, i) => {
          const y = 100 + i * 50;
          return (
            <path
              key={i}
              d={`M 250 ${y} Q 450 ${y - 30}, 560 300`}
              className="hv-stream"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          );
        })}
      </g>

      {/* Moving dots on the streams */}
      <g fill="#e8e6df">
        {Array.from({ length: 12 }).map((_, i) => (
          <circle key={i} r="2" filter="url(#soft-glow)" className="hv-dot" style={{ animationDelay: `${i * 0.35}s` }}>
            <animateMotion
              dur={`${3 + (i % 3)}s`}
              repeatCount="indefinite"
              path={`M 250 ${100 + (i * 40) % 400} Q 450 ${70 + (i * 40) % 400}, 560 300`}
            />
          </circle>
        ))}
      </g>

      {/* The vault: an outlined hexagonal seal on the right */}
      <g transform="translate(560 220)">
        <polygon
          points="80,0 155,45 155,135 80,180 5,135 5,45"
          fill="none"
          stroke="#e8e6df"
          strokeWidth="1.5"
          className="hv-vault"
        />
        <polygon
          points="80,20 138,53 138,127 80,160 22,127 22,53"
          fill="none"
          stroke="#e8e6df"
          strokeWidth="0.8"
          strokeDasharray="3 4"
          className="hv-vault-inner"
        />
        {/* Sealed core */}
        <circle cx="80" cy="90" r="24" fill="#0b0b0b" stroke="#e8e6df" strokeWidth="1.2" />
        <text
          x="80"
          y="94"
          fill="#e8e6df"
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          letterSpacing="0.2em"
        >
          FHE
        </text>
        {/* Rotating outer ring */}
        <g className="hv-ring" style={{ transformOrigin: "80px 90px" }}>
          <circle cx="80" cy="90" r="70" fill="none" stroke="#e8e6df" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="1 6" />
        </g>
      </g>

      {/* Right column: sealed values (redaction bars) */}
      <g className="hv-sealed">
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={i}>
            <text
              x="740"
              y={130 + i * 50}
              fill="#9d9890"
              fontFamily="JetBrains Mono, monospace"
              fontSize="10"
              textAnchor="end"
              letterSpacing="0.14em"
            >
              [SEALED]
            </text>
            <rect
              x="670"
              y={135 + i * 50}
              width="60"
              height="8"
              fill="#161616"
              stroke="#2b2b2b"
              className="hv-bar"
              style={{ animationDelay: `${1 + i * 0.15}s` }}
            />
          </g>
        ))}
      </g>

      {/* Corner ticks - the classified-file frame */}
      <g stroke="#e8e6df" strokeWidth="1.4" fill="none">
        <path d="M 20 20 L 60 20 M 20 20 L 20 60" />
        <path d="M 780 20 L 740 20 M 780 20 L 780 60" />
        <path d="M 20 580 L 60 580 M 20 580 L 20 540" />
        <path d="M 780 580 L 740 580 M 780 580 L 780 540" />
      </g>
    </svg>
  );
}
