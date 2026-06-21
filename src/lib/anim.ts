/**
 * Animation primitives — count-ups, reveals, easings. Pure DOM, no deps.
 */

const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

export interface CountUpOptions {
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  format?: (value: number) => string;
}

/** Animate the textContent of an element from its current numeric value to `target`. */
export function countUp(el: HTMLElement | null, target: number, opts: CountUpOptions = {}): void {
  if (!el) return;
  const duration = opts.duration ?? 700;
  const startRaw = Number((el.textContent ?? "0").replace(/[^\d.-]/g, ""));
  const start = Number.isFinite(startRaw) ? startRaw : 0;
  if (REDUCED || duration <= 0) {
    el.textContent = opts.format
      ? opts.format(target)
      : `${opts.prefix ?? ""}${target.toFixed(opts.decimals ?? 0)}${opts.suffix ?? ""}`;
    return;
  }
  const t0 = performance.now();
  function tick(t: number): void {
    const p = Math.min(1, (t - t0) / duration);
    const eased = easeOutQuart(p);
    const value = start + (target - start) * eased;
    if (el)
      el.textContent = opts.format
        ? opts.format(value)
        : `${opts.prefix ?? ""}${value.toFixed(opts.decimals ?? 0)}${opts.suffix ?? ""}`;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Stagger-reveal a NodeList by adding a class with a per-index delay. */
export function staggerReveal(
  nodes: ArrayLike<HTMLElement> | NodeListOf<HTMLElement>,
  options: { delay?: number; stagger?: number; className?: string } = {},
): void {
  const delay = options.delay ?? 0;
  const stagger = options.stagger ?? 40;
  const className = options.className ?? "reveal-in";
  if (REDUCED) {
    for (let i = 0; i < nodes.length; i++) nodes[i]?.classList.add(className);
    return;
  }
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!el) continue;
    setTimeout(() => el.classList.add(className), delay + i * stagger);
  }
}

/** Apply a 3D tilt to an element on mouse-move, reset on leave. */
export function attachTilt(el: HTMLElement, max = 6): () => void {
  if (REDUCED) return () => {};
  let raf = 0;
  const onMove = (e: MouseEvent): void => {
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const rx = ((cy / rect.height) - 0.5) * -2 * max;
    const ry = ((cx / rect.width) - 0.5) * 2 * max;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    });
  };
  const onLeave = (): void => {
    el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  };
  el.addEventListener("mousemove", onMove);
  el.addEventListener("mouseleave", onLeave);
  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
}

export { easeOutCubic, easeOutQuart };
