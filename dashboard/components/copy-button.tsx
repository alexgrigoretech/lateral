"use client";

import { useState } from "react";

export function CopyButton({ value, label = "page id" }: { value: string; label?: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label.charAt(0).toUpperCase()}${label.slice(1)} copied`);
    } catch {
      setMessage(`Copy unavailable. Select the ${label} to copy it.`);
    }
  }
  return <><button type="button" className="copy-button" onClick={copy} aria-label={label === "page id" ? `Copy ${label} ${value}` : `Copy ${label}`}>Copy {label}</button><span role="status">{message}</span></>;
}
