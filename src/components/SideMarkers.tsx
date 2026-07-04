import { useEffect, useState } from "react";

interface Props {
  left?: string;
  right?: string;
}

/**
 * Fixed vertical text markers on both edges of the viewport. Slight parallax
 * on scroll so they feel physical rather than pasted-on.
 */
export default function SideMarkers({ left, right }: Props) {
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const shift = (scroll * 0.15) % 400;

  return (
    <>
      {left && (
        <div className="side-marker side-marker-left" aria-hidden="true">
          <span
            className="side-marker-text mono"
            style={{ transform: `translateY(${-shift}px)` }}
          >
            {left} · {left} · {left} ·
          </span>
        </div>
      )}
      {right && (
        <div className="side-marker side-marker-right" aria-hidden="true">
          <span
            className="side-marker-text mono"
            style={{ transform: `translateY(${shift}px)` }}
          >
            {right} · {right} · {right} ·
          </span>
        </div>
      )}
    </>
  );
}
