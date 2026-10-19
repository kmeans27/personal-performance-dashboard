/* Motion + feedback. Everything here stays quiet and respects the OS setting. */

export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A short, soft tap. Absent on desktop, harmless where unsupported. */
export function haptic(pattern = 8) {
  if (reducedMotion()) return;
  navigator.vibrate?.(pattern);
}

/** Animate a number up to its value. The one place a count-up is allowed. */
export function countUp(node, to, { duration = 900, digits = 0 } = {}) {
  if (to == null) {
    node.textContent = "—";
    return;
  }
  if (reducedMotion()) {
    node.textContent = to.toFixed(digits);
    return;
  }
  const from = Number(node.textContent) || 0;
  const started = performance.now();
  const step = (now) => {
    const t = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = (from + (to - from) * eased).toFixed(digits);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Mark an element as settling so CSS can run the one signature moment. */
export function settle(node, ms = 1100) {
  if (!node) return;
  node.dataset.settling = "true";
  if (reducedMotion()) return;
  setTimeout(() => {
    node.dataset.settling = "false";
  }, ms);
}

export function after(ms) {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}
