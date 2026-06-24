"use client";

import { useState } from "react";

type CopyButtonProps = {
  getText: () => string;
  label?: string;
};

export function CopyButton({ getText, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = getText();

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:border-gold hover:bg-gold hover:text-ink"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
