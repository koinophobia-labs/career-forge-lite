"use client";

import { useState } from "react";

type CopyButtonProps = {
  getText: () => string;
  label?: string;
};

type CopyStatus = "idle" | "copied" | "empty" | "failed";

export function CopyButton({ getText, label = "Copy" }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [fallbackText, setFallbackText] = useState("");

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const didCopy = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!didCopy) {
      throw new Error("Fallback clipboard copy failed");
    }
  }

  function showStatus(nextStatus: CopyStatus) {
    setStatus(nextStatus);
    if (nextStatus !== "failed") {
      window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  async function handleCopy() {
    const text = getText().trim();

    if (!text) {
      showStatus("empty");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      showStatus("copied");
    } catch {
      try {
        fallbackCopy(text);
        setFallbackText("");
        showStatus("copied");
      } catch {
        setFallbackText(text);
        showStatus("failed");
      }
    }
  }

  const visibleLabel =
    status === "copied" ? "Copied" : status === "empty" ? "Nothing to copy" : status === "failed" ? "Manual copy ready" : label;

  return (
    <span className="inline-flex max-w-full flex-col gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-live="polite"
        className={`inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold transition ${
          status === "failed"
            ? "border-red-400/45 bg-red-50 text-red-700"
            : status === "empty"
              ? "border-gold/45 bg-gold/12 text-ink"
              : "border-ink/15 bg-white text-ink hover:border-gold hover:bg-gold hover:text-ink"
        }`}
      >
        {visibleLabel}
      </button>
      <span className="sr-only" aria-live="polite">
        {visibleLabel}
      </span>
      {status === "failed" && fallbackText && (
        <span className="block max-w-sm rounded-md border border-red-300/45 bg-red-50 p-2 text-xs font-semibold leading-5 text-red-800">
          Copy is blocked in this browser. Select the text below manually.
          <textarea
            readOnly
            value={fallbackText}
            aria-label={`${label} manual copy text`}
            className="mt-2 max-h-28 w-full rounded border border-red-200 bg-white p-2 font-normal text-ink"
            onFocus={(event) => event.currentTarget.select()}
          />
        </span>
      )}
    </span>
  );
}
