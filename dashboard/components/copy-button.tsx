"use client";

import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Page id copied");
    } catch {
      setMessage("Copy unavailable. Select the full page id to copy it.");
    }
  }
  return <><button type="button" onClick={copy} aria-label={`Copy page id ${value}`}>Copy page id</button><span role="status">{message}</span></>;
}
