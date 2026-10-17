// Inside the Mac: maps the scroll position (0..1) onto the story.
// Scenes: open the lid -> a terminal checks the defences -> four windows stream (keys, TLS,
// packets, entropy) -> the laptop comes apart -> follow the data -> it closes again.
// The WebGL scene (mac3d.js plus three.js) loads only once the visitor starts moving through the
// page and the section is near; until then, and without WebGL, a still picture stands in.
// The scene buttons jump to a part of the story. ?p=0.5 freezes one moment (for screenshots).

import { clamp, ease, seg, smooth } from "./ease.js";

const stage = document.getElementById("stage");
const track = document.getElementById("inside");
if (!stage || !track) throw new Error("scene missing");

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const frozenAt = new URLSearchParams(location.search).get("p");
const still = frozenAt !== null || reduced.matches;
const stillP = clamp(frozenAt !== null ? Number(frozenAt) || 0 : 0.62);

const el = {
  caption: document.getElementById("caption"),
  step: document.getElementById("step"),
  nav: document.getElementById("scenes"),
};

const CAPTIONS = [
  { from: 0.05, to: 0.17, text: "Open the lid.", step: "01 / 05" },
  { from: 0.17, to: 0.29, text: "First, check the defences.", step: "02 / 05" },
  { from: 0.29, to: 0.45, text: "Keys. Handshakes. Packets.", step: "03 / 05" },
  { from: 0.48, to: 0.665, text: "Now take it apart.", step: "04 / 05" },
  { from: 0.67, to: 0.845, text: "Follow the data.", step: "05 / 05" },
];

function caption(p) {
  const c = CAPTIONS.find((x) => p >= x.from && p <= x.to);
  if (!c) return { text: "", step: "", cap: 0 };
  const fade = Math.min(seg(p, c.from, c.from + 0.015), 1 - seg(p, c.to - 0.015, c.to));
  return { text: c.text, step: c.step, cap: smooth(clamp(fade)) };
}

const setVar = (name, value) => stage.style.setProperty(name, value.toFixed(4));

let lastText = null;
function hud(p) {
  setVar("--intro", still ? 0 : 1 - ease(p, 0.0, 0.05));
  setVar("--end", ease(p, 0.955, 0.985));
  const c = caption(p);
  if (c.text !== lastText) {
    el.caption.textContent = c.text;
    el.step.textContent = c.step;
    lastText = c.text;
  }
  setVar("--cap", c.cap);
  el.step.style.opacity = c.cap.toFixed(3);
}

/* ---------- part labels follow their parts on screen ---------- */

const labels = [...stage.querySelectorAll(".plabel")].map((node) => ({
  node,
  name: node.dataset.for,
  data: node.classList.contains("data-l"),
}));

function placeLabels(p, mac) {
  const parts = ease(p, 0.585, 0.63) * (1 - ease(p, 0.655, 0.672));
  const data = ease(p, 0.7, 0.735) * (1 - ease(p, 0.82, 0.842));
  const sw = stage.clientWidth;
  for (const l of labels) {
    const o = mac ? (l.data ? data : parts) : 0;
    l.node.style.opacity = o.toFixed(3);
    if (o < 0.01) continue;
    const at = mac.project(l.name);
    if (!at || at.behind) {
      l.node.style.opacity = "0";
      continue;
    }
    const w = l.node.offsetWidth;
    const h = l.node.offsetHeight;
    const gap = Math.max(26, sw * 0.045);
    const pad = Math.max(8, sw * 0.02);
    const toRight = l.node.dataset.side !== "left";
    const dy = Number(l.node.dataset.dy || 0);
    // keep the label on screen; its leader line runs from the label's edge to the part
    const x = clamp(toRight ? at.x + gap : at.x - gap - w, pad, sw - w - pad);
    const y = at.y + dy;
    const ex = toRight ? x : x + w;
    const vx = at.x - ex;
    const vy = at.y - y;
    const ang = toRight ? Math.atan2(-vy, -vx) : Math.atan2(vy, vx);
    l.node.style.setProperty("--len", `${Math.hypot(vx, vy).toFixed(1)}px`);
    l.node.style.setProperty("--ang", `${ang.toFixed(3)}rad`);
    l.node.classList.toggle("on-left", !toRight);
    l.node.style.transform = `translate(${x.toFixed(1)}px, ${(y - h / 2).toFixed(1)}px)`;
  }
}

/* ---------- scene buttons ---------- */

const buttons = el.nav ? [...el.nav.querySelectorAll("button")] : [];
// each button owns the stretch of the story around its moment
const bounds = [0.17, 0.29, 0.46, 0.665, 0.86];
let current = -1;

function markScene(p) {
  let i = -1;
  for (let k = 0; k < buttons.length; k++) if (p >= bounds[k] && p < bounds[k + 1]) i = k;
  if (i === current) return;
  current = i;
  buttons.forEach((b, k) => (k === i ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
}

function seek(p) {
  const top = track.getBoundingClientRect().top + scrollY + p * (track.offsetHeight - innerHeight);
  // main.js glides there with Lenis when it is running; otherwise the browser scrolls
  const handled = !document.dispatchEvent(new CustomEvent("story:seek", { detail: { top }, cancelable: true }));
  if (!handled) scrollTo({ top, behavior: "smooth" });
}

/* ---------- drawing ---------- */

let mac = null;
let inView = false;
let raf = 0;

function progress() {
  if (still) return stillP;
  const r = track.getBoundingClientRect();
  const max = r.height - innerHeight;
  return max > 0 ? clamp(-r.top / max) : 0;
}

function frame(now) {
  raf = 0;
  const p = progress();
  hud(p);
  markScene(p);
  if (mac) mac.update(p, now, still);
  placeLabels(p, mac);
  // the screen streams and the fans turn while the section is on screen
  if (mac && inView && !still && mac.animating(p)) raf = requestAnimationFrame(frame);
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(frame);
}

/* ---------- loading the 3D scene ---------- */

function webgl2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

let loading = false;
async function load() {
  if (loading || !webgl2()) return;
  loading = true;
  try {
    const { createMac } = await import("./mac3d.js");
    mac = await createMac(stage, { compact: innerWidth < 640 || innerWidth / innerHeight < 0.8 });
    new ResizeObserver(() => {
      mac.resize();
      schedule();
    }).observe(stage);
    frame(performance.now());
    requestAnimationFrame(() => stage.classList.add("gl-ready"));
  } catch {
    /* the still picture stays */
  }
}

// wait for a sign of a real visit (scrolling, a key, a touch) and for the section to be near,
// so the page itself loads as fast as before
let intent = still || scrollY > 0;
let near = false;
const maybeLoad = () => intent && near && load();
if (!intent) {
  const go = () => {
    intent = true;
    maybeLoad();
    for (const t of ["scroll", "wheel", "touchstart", "keydown", "pointerdown"]) removeEventListener(t, go);
  };
  for (const t of ["scroll", "wheel", "touchstart", "keydown", "pointerdown"]) addEventListener(t, go, { passive: true });
}

new IntersectionObserver(
  ([e]) => {
    near = e.isIntersecting;
    maybeLoad();
  },
  { rootMargin: "100% 0px" },
).observe(track);

new IntersectionObserver(([e]) => {
  inView = e.isIntersecting;
  if (inView) schedule();
}).observe(track);

window.__story = { set: (p) => mac && mac.update(clamp(p), performance.now(), true) };

if (still) {
  // one still picture: a given moment (?p=) or, for reduced motion, the labelled teardown
  document.documentElement.classList.add("frozen");
  addEventListener("resize", schedule);
} else {
  for (const b of buttons) b.addEventListener("click", () => seek(Number(b.dataset.p)));
  if (el.nav) el.nav.hidden = false;
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
}
schedule();
