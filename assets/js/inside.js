// Inside the Mac: maps the scroll position (0..1) onto the scene.
// Scenes: open lid and terminal -> windows (labs 1-2) -> tear down -> lens -> network chip (lab 4).
// The scene buttons jump to a part of the story. ?p=0.5 freezes the scene at one moment (for screenshots).

const stage = document.getElementById("stage");
const track = document.getElementById("inside");
const world = document.getElementById("world");
const lens = document.getElementById("lens");
if (!stage || !track) throw new Error("scene missing");

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (p, a, b) => smooth(seg(p, a, b));
const lerp = (a, b, t) => a + (b - a) * t;

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const frozenAt = new URLSearchParams(location.search).get("p");

const el = {
  winTerm: document.getElementById("win-term"),
  winShark: document.getElementById("win-shark"),
  winUfw: document.getElementById("win-ufw"),
  winArp: document.getElementById("win-arp"),
  cmd: document.getElementById("t-cmd"),
  out: document.getElementById("t-out"),
  caret: document.getElementById("t-caret"),
  caption: document.getElementById("caption"),
  step: document.getElementById("step"),
  endLink: document.querySelector("#end .link"),
};

const COMMAND = "arp -a";
const OUTPUT = "? (192.168.64.2) at <mac> on bridge100 ifscope [bridge]";

// what the caption says, and when
const CAPTIONS = [
  { from: 0.05, to: 0.45, text: "Open the lid. Open a terminal.", step: "01 / 05", late: 0.0 },
  { from: 0.22, to: 0.45, text: "Capture it. Block it.", step: "02 / 05  ·  labs 1 and 2" },
  { from: 0.48, to: 0.65, text: "Now take it apart.", step: "03 / 05" },
  { from: 0.66, to: 0.82, text: "Down to the lens.", step: "04 / 05" },
  { from: 0.84, to: 0.935, text: "The network chip asks: who has 192.168.64.1?", step: "05 / 05  ·  lab 4" },
];

function state(p) {
  // on a tall phone-shaped screen the Mac fills the width, so it is drawn smaller to leave room for the labels
  const k = innerWidth / innerHeight < 0.8 ? 0.82 : 1;
  const open = ease(p, 0.05, 0.2) - ease(p, 0.4, 0.47);
  const ex = ease(p, 0.48, 0.63) - ease(p, 0.92, 0.99);
  const lensIn = ease(p, 0.655, 0.7) - ease(p, 0.8, 0.84);
  return {
    lid: 104 * open,
    glow: open * (1 - ease(p, 0.4, 0.47)),
    ex,
    // the camera slowly orbits and sits higher once the stack is tall
    rx: lerp(62, 52, ease(p, 0.46, 0.62)) + lerp(0, 6, ease(p, 0.92, 0.99)),
    rz: -34 + 16 * ease(p, 0.0, 0.2) - 30 * ease(p, 0.46, 0.66) + 18 * ease(p, 0.86, 1),
    zoom: k * (lerp(1, 0.74, ease(p, 0.48, 0.63)) + 0.2 * ease(p, 0.93, 1)),
    shift: lerp(0, 2, ease(p, 0.48, 0.63)),
    intro: 1 - ease(p, 0.0, 0.06),
    lensIn,
    lx: ease(p, 0.69, 0.79),
    nic: ease(p, 0.83, 0.88) * (1 - ease(p, 0.93, 0.97)),
    end: ease(p, 0.955, 0.985),
    win: {
      term: ease(p, 0.14, 0.18) - ease(p, 0.3, 0.34),
      shark: ease(p, 0.24, 0.28) - ease(p, 0.38, 0.42),
      ufw: ease(p, 0.3, 0.34) - ease(p, 0.405, 0.445),
      arp: ease(p, 0.83, 0.87) - ease(p, 0.93, 0.965),
    },
    type: seg(p, 0.16, 0.215),
    out: ease(p, 0.225, 0.245) - ease(p, 0.3, 0.325),
  };
}

function caption(p) {
  let best = null;
  for (const c of CAPTIONS) {
    if (p >= c.from && p <= c.to) best = c;
  }
  if (!best) return { text: "", step: "", cap: 0 };
  const fade = Math.min(seg(p, best.from, best.from + 0.02), 1 - seg(p, best.to - 0.02, best.to));
  return { text: best.text, step: best.step, cap: smooth(clamp(fade)) };
}

const setVar = (node, name, value) => node.style.setProperty(name, typeof value === "number" ? value.toFixed(4) : value);

let lastText = "";
function apply(p) {
  const s = state(p);
  setVar(stage, "--lid", s.lid);
  setVar(stage, "--glow", s.glow);
  setVar(stage, "--ex", s.ex);
  setVar(stage, "--rx", s.rx);
  setVar(stage, "--rz", s.rz);
  setVar(stage, "--zoom", s.zoom);
  setVar(stage, "--shift", s.shift);
  setVar(stage, "--intro", s.intro);
  setVar(stage, "--lens-in", s.lensIn);
  setVar(stage, "--lx", s.lx);
  setVar(stage, "--nic", s.nic);
  setVar(stage, "--end", s.end);
  el.endLink.style.visibility = s.end > 0.01 ? "visible" : "hidden";
  lens.style.display = s.lensIn > 0.001 ? "block" : "none";

  setVar(el.winTerm, "--o", s.win.term);
  setVar(el.winShark, "--o", s.win.shark);
  setVar(el.winUfw, "--o", s.win.ufw);
  setVar(el.winArp, "--o", s.win.arp);
  for (const w of [el.winTerm, el.winShark, el.winUfw, el.winArp]) w.style.visibility = Number(w.style.getPropertyValue("--o")) > 0.001 ? "visible" : "hidden";

  el.cmd.textContent = COMMAND.slice(0, Math.round(COMMAND.length * s.type));
  el.caret.style.display = s.type < 1 && s.type > 0 ? "" : "none";
  el.out.textContent = s.out > 0.02 ? OUTPUT : "";
  el.out.style.opacity = s.out.toFixed(3);

  const c = caption(p);
  if (c.text !== lastText) {
    el.caption.textContent = c.text;
    el.step.textContent = c.step;
    lastText = c.text;
  }
  setVar(stage, "--cap", c.cap);
  el.step.style.opacity = c.cap.toFixed(3);

  placeLabels(p, s);
  markScene(p);
}

/* ---------- part labels follow their parts on screen ---------- */

const labels = [...document.querySelectorAll(".plabel")].map((node, i) => ({
  node,
  anchor: stage.querySelector(`.anchor[data-label="${node.dataset.for}"]`),
  lens: node.classList.contains("lens-l"),
  i,
}));

function placeLabels(p, s) {
  const sr = stage.getBoundingClientRect();
  const partsOn = ease(p, 0.575, 0.635) * (1 - s.lensIn) * (1 - ease(p, 0.915, 0.95));
  const lensOn = ease(p, 0.755, 0.8) * s.lensIn;
  for (const l of labels) {
    const strength = l.lens ? lensOn : partsOn;
    // the network chip label stays on while that scene plays
    const nicBoost = l.node.dataset.for === "nic" ? s.nic * (1 - s.lensIn) : 0;
    const o = Math.max(strength, nicBoost);
    l.node.style.opacity = o.toFixed(3);
    if (o < 0.01 || !l.anchor) continue;
    const r = l.anchor.getBoundingClientRect();
    const cx = r.left - sr.left;
    const cy = r.top - sr.top;
    const w = l.node.offsetWidth;
    const h = l.node.offsetHeight;
    const gap = Math.max(26, sr.width * 0.045);
    const pad = Math.max(8, sr.width * 0.02);
    const toRight = l.node.dataset.side !== "left";
    // keep the label on screen and let its leader line stretch or shrink to meet the part
    const x = clamp(toRight ? cx + gap : cx - gap - w, pad, sr.width - w - pad);
    const len = toRight ? Math.max(0, x - cx) : Math.max(0, cx - (x + w));
    l.node.style.setProperty("--len", `${len}px`);
    l.node.classList.toggle("on-left", !toRight);
    l.node.style.transform = `translate(${x.toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px)`;
  }
}

/* ---------- scroll to progress ---------- */

function scrollProgress() {
  const r = track.getBoundingClientRect();
  const max = r.height - innerHeight;
  return max > 0 ? clamp(-r.top / max) : 0;
}

let frame = 0;
function tick() {
  frame = 0;
  apply(scrollProgress());
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(tick);
}

window.__story = { set: (p) => apply(clamp(p)) };

/* ---------- scene buttons ---------- */

const nav = document.getElementById("scenes");
const buttons = nav ? [...nav.querySelectorAll("button")] : [];
// each button owns the stretch of the story around its moment
const bounds = [0.1, 0.29, 0.46, 0.66, 0.83, 0.96];
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

if (frozenAt !== null || reduced.matches) {
  // one still picture: a given moment (?p=) or, for reduced motion, the labelled teardown
  document.documentElement.classList.add("frozen");
  apply(clamp(frozenAt !== null ? Number(frozenAt) || 0 : 0.63));
} else {
  for (const b of buttons) b.addEventListener("click", () => seek(Number(b.dataset.p)));
  if (nav) nav.hidden = false;
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  apply(scrollProgress());
}
