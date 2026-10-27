// Marks [data-anim] elements as they enter the screen, once each, so motion.css can play their
// entrance. Counters ([data-anim="count"]) count up to the number already in the page. With
// reduced motion, or without IntersectionObserver, everything is shown at once.

const root = document.documentElement;
root.setAttribute("data-motion-ready", "");
const reduce =
  matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-reduce-motion");
const targets = document.querySelectorAll<HTMLElement>("[data-anim]");

function countUp(element: HTMLElement) {
  const final = element.textContent ?? "";
  const target = Number.parseInt(final.replace(/\D/g, ""), 10);
  if (!Number.isFinite(target) || target <= 0) return;
  element.setAttribute("aria-label", final);
  const start = performance.now();
  const duration = 900;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    element.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(step);
    else element.textContent = final;
  };
  requestAnimationFrame(step);
}

function show(element: HTMLElement) {
  element.setAttribute("data-anim-in", "");
  if (element.dataset.anim === "count" && !reduce) countUp(element);
}

if (reduce || !("IntersectionObserver" in window)) {
  for (const element of targets) element.setAttribute("data-anim-in", "");
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        show(entry.target as HTMLElement);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const element of targets) observer.observe(element);
}
