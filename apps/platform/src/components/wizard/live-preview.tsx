"use client";

import type { SiteConfig } from "@brotasites/schema";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Renders the real template through the preview server (apps/preview).
// The draft is POSTed into one of two iframes; the hidden one loads the update and only then
// swaps in, so the client never sees a blank flash. The reading position is carried over.

export const PREVIEW_URL = process.env.NEXT_PUBLIC_PREVIEW_URL ?? "http://localhost:4400";
const DESKTOP_WIDTH = 1280;
const PHONE_WIDTH = 390;
const UPDATE_DELAY_MS = 280;

export type Device = "celular" | "computador";
type Status = "loading" | "ready" | "offline";

export function LivePreview({ config, device }: { config: SiteConfig; device: Device }) {
  const baseName = useId().replace(/:/g, "");
  const names = [`${baseName}-a`, `${baseName}-b`] as const;
  const json = useMemo(() => JSON.stringify(config), [config]);

  const [active, setActive] = useState<0 | 1 | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [size, setSize] = useState({ width: 0, height: 0 });

  const boxRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const activeRef = useRef<0 | 1 | null>(null);
  const pendingRef = useRef<0 | 1 | null>(null);
  const scrollRef = useRef(0);
  const sentOnce = useRef(false);

  // Keep the iframe sized to the frame it sits in.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Tell the client plainly when the preview server cannot be reached.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${PREVIEW_URL}/render`, { mode: "no-cors", signal: controller.signal }).catch(() => {
      if (!controller.signal.aborted) setStatus("offline");
    });
    return () => controller.abort();
  }, []);

  // Follow the reading position reported by the visible preview.
  useEffect(() => {
    const origin = new URL(PREVIEW_URL).origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.type !== "brotasites:preview-scroll") return;
      const visible = activeRef.current;
      const frame =
        visible === null
          ? null
          : document.querySelector<HTMLIFrameElement>(`iframe[name="${names[visible]}"]`);
      if (frame && event.source === frame.contentWindow)
        scrollRef.current = Number(event.data.y) || 0;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [names]);

  // Send the draft (right away the first time, then after a short pause in typing).
  useEffect(() => {
    const timer = setTimeout(
      () => {
        const form = formRef.current;
        if (!form) return;
        const target: 0 | 1 = activeRef.current === 0 ? 1 : 0;
        (form.elements.namedItem("config") as HTMLInputElement).value = json;
        (form.elements.namedItem("scroll") as HTMLInputElement).value = String(scrollRef.current);
        (form.elements.namedItem("animate") as HTMLInputElement).value = sentOnce.current
          ? "0"
          : "1";
        form.target = names[target];
        pendingRef.current = target;
        sentOnce.current = true;
        form.submit();
      },
      sentOnce.current ? UPDATE_DELAY_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [json, names]);

  function onFrameLoad(index: 0 | 1) {
    if (pendingRef.current !== index) return;
    pendingRef.current = null;
    activeRef.current = index;
    setActive(index);
    setStatus((current) => (current === "offline" ? current : "ready"));
  }

  const viewport = device === "computador" ? DESKTOP_WIDTH : PHONE_WIDTH;
  const scale = size.width ? Math.min(1, size.width / viewport) : 1;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden">
      <form ref={formRef} method="post" action={`${PREVIEW_URL}/render`} hidden>
        <input type="hidden" name="config" />
        <input type="hidden" name="scroll" />
        <input type="hidden" name="animate" />
      </form>

      {names.map((name, index) => (
        <iframe
          key={name}
          name={name}
          title="Prévia do site"
          data-active={active === index}
          // The preview is another origin, so allow-same-origin does not reach the platform.
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => onFrameLoad(index as 0 | 1)}
          className={cn(
            "absolute top-0 left-0 origin-top-left border-0 bg-white transition-opacity duration-200",
            active === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{
            width: viewport,
            height: scale ? size.height / scale : size.height,
            transform: `scale(${scale})`,
          }}
          tabIndex={active === index ? 0 : -1}
          aria-hidden={active !== index}
        />
      ))}

      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center bg-card p-8 text-center">
          {status === "offline" ? (
            <p className="max-w-[30ch] text-ink-soft">
              A prévia não está disponível agora. Suas respostas continuam salvas.
            </p>
          ) : (
            <p className="tag inline-flex items-center gap-2 text-ink-soft">
              <span
                className="live-dot relative size-2 rounded-full bg-pollen"
                aria-hidden="true"
              />
              Preparando a prévia
            </p>
          )}
        </div>
      )}
    </div>
  );
}
