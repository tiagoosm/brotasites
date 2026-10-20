"use client";

import { buildPreviewConfig, PLACEHOLDER_SUBDOMAIN, suggestSubdomain } from "@brotasites/schema";
import { useMemo, useState } from "react";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import { type Device, LivePreview } from "./live-preview";

// The "table" the client's site sits on: device switch, live marker and a browser frame
// showing the address the site will get, with the real template rendered inside.
export function PreviewPanel({ compact = false }: { compact?: boolean }) {
  const { draft } = useDraft();
  const [device, setDevice] = useState<Device>(compact ? "celular" : "computador");
  const config = useMemo(() => buildPreviewConfig(draft), [draft]);
  const address = `${draft.site?.subdomain ?? suggestSubdomain(draft.business?.name) ?? PLACEHOLDER_SUBDOMAIN}.brotasites.com`;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <fieldset className="inline-flex rounded-full border border-border bg-card p-[3px] text-[0.8125rem]">
          <legend className="sr-only">Tamanho da prévia</legend>
          {(["celular", "computador"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={device === option}
              onClick={() => setDevice(option)}
              className={cn(
                "rounded-full px-3.5 py-1.5 capitalize transition-colors duration-200",
                device === option
                  ? "bg-ink font-semibold text-white"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {option}
            </button>
          ))}
        </fieldset>
        <span className="tag inline-flex items-center gap-2 text-ink-soft">
          <span className="live-dot relative size-2 rounded-full bg-pollen" aria-hidden="true" />
          Prévia ao vivo
        </span>
      </div>

      <div
        className={cn(
          "mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden border border-border bg-card shadow-[0_30px_50px_-40px_rgb(20_36_27/0.7)] transition-[max-width] duration-500 ease-[var(--ease-out)]",
          device === "celular" ? "max-w-[390px] rounded-[2rem]" : "max-w-full rounded-xl",
        )}
      >
        <div className="flex h-10 shrink-0 items-center justify-center border-b border-border px-3">
          <span className="tag truncate rounded-full bg-paper px-3.5 py-1 normal-case tracking-[0.02em] text-ink-soft">
            {address}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <LivePreview config={config} device={device} />
        </div>
      </div>
    </div>
  );
}
