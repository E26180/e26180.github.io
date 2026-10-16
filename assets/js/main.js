// Entry point: theme toggle, the typed `whoami` line and the active nav link.
// Every feature degrades to plain, readable HTML if JavaScript is off.

const root = document.documentElement;
export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function store(kind, key, value) {
  try {
    const s = kind === "local" ? localStorage : sessionStorage;
    if (value === undefined) return s.getItem(key);
    s.setItem(key, value);
  } catch {
    return null;
  }
  return null;
}

/* ---------- theme ---------- */

function initTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const meta = document.querySelector('meta[name="theme-color"]');

  const sync = () => {
    const light = root.dataset.theme === "light";
    button.setAttribute("aria-pressed", String(light));
    if (meta) meta.setAttribute("content", light ? "#f5f7fa" : "#070b12");
  };

  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    store("local", "theme", root.dataset.theme);
    sync();
  });
  sync();
}

/* ---------- typed whoami ---------- */

function initTyping() {
  const card = document.getElementById("whoami");
  if (!card) return;
  const lines = [...card.querySelectorAll("[data-typed]")];
  const skip = card.querySelector(".skip-anim");
  if (reducedMotion.matches || store("session", "typed") === "1" || !lines.length) return;

  let timer = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    card.classList.remove("is-typing");
    lines.forEach((l) => l.classList.remove("typing-now"));
    lines.forEach((l) => (l.querySelector(".typed-live").textContent = ""));
    if (skip) {
      // the skip button disappears, so hand focus to the next sensible control
      if (document.activeElement === skip) card.closest(".hero")?.querySelector(".hero-actions a")?.focus();
      skip.hidden = true;
    }
    store("session", "typed", "1");
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") finish();
  };

  card.classList.add("is-typing");
  if (skip) {
    skip.hidden = false;
    skip.addEventListener("click", finish);
  }
  document.addEventListener("keydown", onKey);
  reducedMotion.addEventListener?.("change", finish);

  const jobs = lines.map((l, i) => ({
    live: l.querySelector(".typed-live"),
    text: l.querySelector(".typed-ghost").textContent,
    speed: i === 0 ? 85 : 16,
    pause: i === 0 ? 380 : 0, // let the prompt sit for a beat before the command is typed
  }));

  let line = 0;
  let pos = 0;
  const tick = () => {
    if (done) return;
    const job = jobs[line];
    lines.forEach((l, i) => l.classList.toggle("typing-now", i === line));
    pos += 1;
    job.live.textContent = job.text.slice(0, pos);
    if (pos >= job.text.length) {
      line += 1;
      pos = 0;
      if (line >= jobs.length) {
        timer = setTimeout(finish, 600);
        return;
      }
      timer = setTimeout(tick, 320);
      return;
    }
    timer = setTimeout(tick, job.speed);
  };
  timer = setTimeout(tick, jobs[0].pause);
}

/* ---------- current section in the nav ---------- */

function initNav() {
  const links = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.removeAttribute("aria-current"));
        links.find((a) => a.getAttribute("href") === `#${entry.target.id}`)?.setAttribute("aria-current", "true");
      });
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  sections.forEach((s) => io.observe(s));
}

// CSS animations that are not essential (the diagram packets) only run with this class.
const syncMotion = () => root.classList.toggle("motion-ok", !reducedMotion.matches);
reducedMotion.addEventListener?.("change", syncMotion);
syncMotion();

initTheme();
initTyping();
initNav();

// The lanyard is decorative, so it loads after the page is usable.
if (document.getElementById("lanyard")) import("./badge.js");
if (document.getElementById("notebook-list")) import("./notebook.js");

/* ---------- terminal (loaded on first use) ---------- */

const termButton = document.getElementById("terminal-open");
const openTerminal = async (from) => (await import("./terminal.js")).open(from);
const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

termButton?.addEventListener("click", () => openTerminal(termButton));
document.addEventListener("keydown", (e) => {
  if (!termButton || e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
  if (document.getElementById("terminal")?.open) return;
  e.preventDefault();
  openTerminal(termButton);
});
