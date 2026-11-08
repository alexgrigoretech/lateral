"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";

export function Selector({ label, parameter, value, options }: { label: string; parameter: string; value: string; options: { value: string; label: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const labelId = useId();
  function select(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(parameter, next);
    if (parameter === "indicator") params.delete("stat");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }
  return <div className="control">
    <span className="control__label" id={labelId}>{label}</span>
    <div className="segmented" role="group" aria-labelledby={labelId}>
      {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} className={`segmented__option${value === option.value ? " segmented__option--active" : ""}`} onClick={() => select(option.value)}>{option.label}</button>)}
    </div>
  </div>;
}
