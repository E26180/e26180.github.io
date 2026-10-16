// The access pass on a lanyard: a small Verlet rope with the card hanging from its last point.
// Decorative only (aria-hidden); the same facts are in the page text. The loop sleeps once the
// pass is at rest or off-screen, and the pass hangs still when reduced motion is requested.

const lanyard = document.getElementById("lanyard");
const badge = document.getElementById("badge");
const strap = document.getElementById("strap-path");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

const N = 14; // rope points, the last one is the card's clip
const GRAVITY = 2400; // px/s²
const DAMPING = 0.992;
const STEP = 1 / 120;

let pts = [];
let anchor = { x: 0, y: 0 };
let seg = 10;
let ropeLen = 200;
let box = { w: 0, h: 0 };
let card = { w: 0, h: 0 };
let angle = 0;
let angVel = 0;
let drag = null;
let raf = 0;
let last = 0;
let acc = 0;
let still = 0;
let visible = true;

function measure() {
  const r = lanyard.getBoundingClientRect();
  box = { w: r.width, h: r.height };
  card = { w: badge.offsetWidth, h: badge.offsetHeight };
  anchor = { x: box.w / 2, y: -48 };
  const restClip = Math.max(70, box.h - card.h - 48);
  ropeLen = restClip - anchor.y;
  seg = ropeLen / (N - 1);
}

function layout(startAngle) {
  pts = Array.from({ length: N }, (_, i) => {
    const x = anchor.x + Math.sin(startAngle) * seg * i;
    const y = anchor.y + Math.cos(startAngle) * seg * i;
    return { x, y, px: x, py: y };
  });
  angle = 0;
  angVel = 0;
}

function step(dt) {
  const end = pts[N - 1];
  for (let i = 1; i < N; i++) {
    const p = pts[i];
    if (i === N - 1 && drag) continue;
    const vx = (p.x - p.px) * DAMPING;
    const vy = (p.y - p.py) * DAMPING;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + GRAVITY * dt * dt;
  }
  if (drag) {
    end.px = end.x;
    end.py = end.y;
    end.x = drag.x;
    end.y = drag.y;
  }
  for (let k = 0; k < 18; k++) {
    for (let i = 0; i < N - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const ia = i === 0 ? 0 : 1;
      const ib = i + 1 === N - 1 ? (drag ? 0 : 0.45) : 1; // the card is heavier than the strap
      const sum = ia + ib;
      if (!sum) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - seg) / d;
      a.x += dx * diff * (ia / sum);
      a.y += dy * diff * (ia / sum);
      b.x -= dx * diff * (ib / sum);
      b.y -= dy * diff * (ib / sum);
    }
  }
  // the card turns towards the direction of the last strap segment, with a little lag
  const prev = pts[N - 2];
  const target = -Math.atan2(end.x - prev.x, end.y - prev.y);
  angVel += (target - angle) * 0.18;
  angVel *= 0.78;
  angle += angVel;
}

function render() {
  const end = pts[N - 1];
  badge.style.transform = `translate(${(end.x - card.w / 2).toFixed(2)}px, ${end.y.toFixed(2)}px) rotate(${angle.toFixed(4)}rad)`;
  badge.style.setProperty("--tilt", Math.max(-1, Math.min(1, angle * 2.5)).toFixed(3));
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < N - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  d += ` L${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  strap.setAttribute("d", d);
}

function frame(t) {
  raf = 0;
  const dt = Math.min(0.05, (t - (last || t)) / 1000);
  last = t;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 6) {
    step(STEP);
    acc -= STEP;
    n++;
  }
  render();
  const energy = pts.reduce((s, p) => s + Math.abs(p.x - p.px) + Math.abs(p.y - p.py), 0) + Math.abs(angVel) * 50;
  still = energy < 0.05 && !drag ? still + 1 : 0;
  if (still < 40 && visible) raf = requestAnimationFrame(frame);
}

function wake() {
  still = 0;
  if (!raf && visible) {
    last = 0;
    acc = 0;
    raf = requestAnimationFrame(frame);
  }
}

function local(e) {
  const r = lanyard.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function clampToRope(x, y) {
  const dx = x - anchor.x;
  const dy = y - anchor.y;
  const d = Math.hypot(dx, dy);
  const max = ropeLen * 1.02;
  const k = d > max ? max / d : 1;
  const cx = anchor.x + dx * k;
  return { x: Math.max(card.w / 2, Math.min(box.w - card.w / 2, cx)), y: anchor.y + dy * k };
}

function onDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  const p = local(e);
  const end = pts[N - 1];
  drag = { ox: p.x - end.x, oy: p.y - end.y, x: end.x, y: end.y };
  badge.setPointerCapture(e.pointerId);
  wake();
}

function onMove(e) {
  if (!drag) return;
  const p = local(e);
  const t = clampToRope(p.x - drag.ox, p.y - drag.oy);
  drag.x = t.x;
  drag.y = t.y;
  wake();
}

function onUp() {
  drag = null;
  wake();
}

function setStatic() {
  cancelAnimationFrame(raf);
  raf = 0;
  measure();
  layout(0);
  render();
}

function start() {
  measure();
  if (motion.matches) {
    lanyard.classList.add("is-static");
    setStatic();
    return;
  }
  layout(0.75); // start pulled to one side so the pass swings in
  render();
  wake();
  badge.addEventListener("pointerdown", onDown);
  badge.addEventListener("pointermove", onMove);
  badge.addEventListener("pointerup", onUp);
  badge.addEventListener("pointercancel", onUp);
  badge.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || drag) return;
    pts[N - 1].px -= 2.5; // a small nudge on hover
    wake();
  });
}

if (lanyard && badge && strap) {
  start();
  // a new size changes the rope length, so restart from rest instead of snapping the strap
  // (mobile browsers also fire resize when the address bar hides, so ignore same-size events)
  window.addEventListener("resize", () => {
    const before = `${box.w}x${box.h}`;
    measure();
    if (`${box.w}x${box.h}` === before) return;
    layout(0);
    render();
  });
  motion.addEventListener?.("change", () => {
    if (motion.matches) setStatic();
    else wake();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !motion.matches) wake();
    }).observe(lanyard);
  }
}
