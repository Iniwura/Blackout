import { useState } from "react";

interface Props {
  value: string;
  label?: string;
  className?: string;
}

/**
 * Small copy-to-clipboard button. Shows a checkmark for 900ms after copy.
 * Silent no-op if the clipboard API is unavailable (older browsers, iframes).
 */
export default function CopyButton({ value, label = "copy", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // clipboard unavailable, silent fallback
    }
  }

  return (
    <button
      type="button"
      className={`copy-btn mono ${className}`}
      onClick={handle}
      aria-label={`Copy ${label}`}
    >
      {copied ? "copied" : label}
    </button>
  );
}
