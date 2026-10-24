import { cn } from "@/lib/utils";

// The pill tag used for single choices (business type, button destination), shared by the
// form and the home page so both always look the same.

export function chipClass({ checked, invalid = false }: { checked: boolean; invalid?: boolean }) {
  return cn(
    "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] transition-[background-color,border-color,color] duration-150 select-none",
    checked
      ? "border-leaf bg-leaf-wash font-semibold text-leaf-deep"
      : cn(
          "bg-card text-ink hover:border-ink-soft",
          invalid ? "border-destructive" : "border-input",
        ),
  );
}
