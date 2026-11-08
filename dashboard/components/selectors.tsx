"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type KeyboardEvent } from "react";

export function Selector({ label, parameter, value, options }: { label: string; parameter: string; value: string; options: { value: string; label: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const labelId = useId();
  const [message, setMessage] = useState("");
  function select(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(parameter, next);
    if (parameter === "indicator") params.delete("stat");
    setMessage(`${label}: ${options.find((option) => option.value === next)?.label ?? next}`);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
    select(options[next].value);
  }
  return <div className="control">
    <span className="control__label" id={labelId}>{label}</span>
    <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
      {options.map((option, index) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} tabIndex={value === option.value ? 0 : -1} className={`segmented__option${value === option.value ? " segmented__option--active" : ""}`} onClick={() => select(option.value)} onKeyDown={(event) => navigate(event, index)}>{option.label}</button>)}
    </div>
    <span className="visually-hidden" role="status">{message}</span>
  </div>;
}
