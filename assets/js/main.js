// Entry point: theme, typed `whoami` line, scroll reveal, nav state, smooth scrolling.
// Every feature degrades to plain, readable HTML if JavaScript is off, and nothing hides
// content before this module has run (the `js` class is only added here).

const root = document.documentElement;
root.classList.add("js");

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
    if (meta) meta.setAttribute("content", light ? "#f6f7f9" : "#070b12");
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
    pause: i === 0 ? 700 : 0, // let the name finish rising and the prompt sit for a beat
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

/* ---------- scroll reveal ---------- */

function initReveal() {
  // children of [data-stagger] reveal one after another
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    [...group.children]
      .filter((c) => !c.classList.contains("rail"))
      .forEach((child, i) => {
        child.setAttribute("data-reveal", "");
        child.style.setProperty("--i", i);
      });
  });

  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}

/* ---------- header border, progress bar fallback ---------- */

function initScrollState() {
  const fallback = !CSS.supports("animation-timeline: scroll()");
  const bar = document.querySelector(".progress");
  let frame = 0;
  const update = () => {
    frame = 0;
    const y = window.scrollY;
    root.classList.toggle("is-scrolled", y > 8);
    if (fallback && bar && !reducedMotion.matches) {
      const max = root.scrollHeight - window.innerHeight;
      bar.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : "0");
    }
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

/* ---------- current section in the nav ---------- */

function initNav() {
  if (!("IntersectionObserver" in window)) return;
  // a link counts for a section of this page: "/#work" or, on the home page, "/lab/" for #lab
  const pairs = [...document.querySelectorAll(".site-nav a")]
    .map((a) => {
      const url = new URL(a.href);
      let id = url.pathname === location.pathname ? url.hash.slice(1) : "";
      if (!id && location.pathname === "/" && url.pathname === "/lab/") id = "lab";
      return { a, section: id && document.getElementById(id) };
    })
    .filter((p) => p.section);
  if (!pairs.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        pairs.forEach((p) => p.a.removeAttribute("aria-current"));
        pairs.find((p) => p.section === entry.target)?.a.setAttribute("aria-current", "true");
      });
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  pairs.forEach((p) => io.observe(p.section));
}

/* ---------- smooth scrolling (Lenis, loaded once the page is idle) ---------- */

let lenis = null;

function initSmoothScroll() {
  // only for a mouse or trackpad, and never when motion is reduced or data is being saved
  if (reducedMotion.matches || !matchMedia("(pointer: fine)").matches || navigator.connection?.saveData) return;
  const start = async () => {
    try {
      const { default: Lenis } = await import("/assets/vendor/lenis.mjs");
      lenis = new Lenis({ autoRaf: true, lerp: 0.1 });
      reducedMotion.addEventListener?.("change", () => {
        if (reducedMotion.matches) {
          lenis?.destroy();
          lenis = null;
        }
      });
    } catch {
      /* native scrolling keeps working */
    }
  };
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn) : setTimeout(fn, 200));
  if (document.readyState === "complete") idle(start);
  else addEventListener("load", () => idle(start), { once: true });
  // links to a section of this page glide there and land where the native jump would
  document.addEventListener("click", (e) => {
    if (!lenis || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a || a.target === "_blank") return;
    const url = new URL(a.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target); // Lenis honours the section's scroll-margin and the page's scroll-padding itself
    history.pushState(null, "", url.hash);
    // keep keyboard users in the section they just chose
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
  // the terminal is a modal: freeze the page behind it
  document.addEventListener("terminal:open", () => lenis?.stop());
  document.addEventListener("terminal:close", () => lenis?.start());
}

/* ---------- terminal (loaded on first use) ---------- */

function initTerminal() {
  const button = document.getElementById("terminal-open");
  if (!button) return;
  const open = async (from) => (await import("./terminal.js")).open(from);
  const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  button.addEventListener("click", () => open(button));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (document.getElementById("terminal")?.open) return;
    e.preventDefault();
    open(button);
  });
}

// CSS animations that are not essential (the lab diagram packets) only run with this class.
const syncMotion = () => root.classList.toggle("motion-ok", !reducedMotion.matches);
reducedMotion.addEventListener?.("change", syncMotion);
syncMotion();

initTheme();
initTyping();
initReveal();
initScrollState();
initNav();
initSmoothScroll();
initTerminal();

// page-specific modules load only where they are used
if (document.getElementById("lanyard")) import("./badge.js");
if (document.getElementById("notebook-list")) import("./notebook.js");
if (document.getElementById("diagram")) import("./lab.js");
