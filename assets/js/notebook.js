// "Latest from my lab notebook": the three newest write-ups in E26180/security-notes.
// One GitHub API call per browser session (cached in sessionStorage), titles read from the raw
// files, and the static list in the HTML stays in place if anything fails.

const REPO = "E26180/security-notes";
const TREE = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
const raw = (path) => `https://raw.githubusercontent.com/${REPO}/main/${path}`;
const blob = (path) => `https://github.com/${REPO}/blob/main/${path}`;
const CACHE_KEY = "notebook:v1";
const CACHE_MS = 30 * 60 * 1000;
const FILE = /^(labs|notes)\/(\d{4}-\d{2}-\d{2})-([^/]+)\.md$/;

const list = document.getElementById("notebook-list");
const status = document.getElementById("notebook-status");
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function readCache() {
  try {
    const hit = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    return hit && Date.now() - hit.at < CACHE_MS ? hit : null;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* storage can be unavailable; the list still renders */
  }
}

async function get(url, as) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: as === "json" ? { Accept: "application/vnd.github+json" } : {},
      referrerPolicy: "no-referrer",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return as === "json" ? res.json() : res.text();
  } finally {
    clearTimeout(timer);
  }
}

const prettySlug = (slug) => slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

async function titleOf(path, slug) {
  try {
    const text = await get(raw(path), "text");
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    // some notes start with their date ("14 Oct 2026 – …"); the date is shown separately
    return heading ? heading.replace(/^\d{1,2} \w{3} \d{4}\s+[–-]\s+/, "") : prettySlug(slug);
  } catch {
    return prettySlug(slug);
  }
}

async function fetchLatest() {
  const tree = await get(TREE, "json");
  const files = (tree.tree || [])
    .filter((n) => n.type === "blob" && FILE.test(n.path))
    .map((n) => {
      const [, folder, date, slug] = n.path.match(FILE);
      return { path: n.path, folder, date, slug };
    })
    .sort((a, b) => (a.date === b.date ? b.path.localeCompare(a.path) : b.date.localeCompare(a.date)))
    .slice(0, 3);
  if (!files.length) throw new Error("no write-ups found");
  return Promise.all(
    files.map(async (f) => ({
      date: f.date,
      kind: f.folder === "labs" ? "Lab" : "Notes",
      title: await titleOf(f.path, f.slug),
      url: blob(f.path),
    })),
  );
}

// Built with textContent only: titles come from another site and are never parsed as HTML.
function render(items) {
  const rows = items.map((item) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const time = document.createElement("time");
    time.className = "nb-date";
    time.dateTime = item.date;
    time.textContent = day.format(new Date(`${item.date}T00:00:00Z`));
    const kind = document.createElement("span");
    kind.className = "nb-kind";
    kind.textContent = item.kind;
    const title = document.createElement("span");
    title.className = "nb-title";
    title.textContent = item.title;
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = " (opens in a new tab)";
    title.append(sr);
    const go = document.createElement("span");
    go.className = "nb-go";
    go.setAttribute("aria-hidden", "true");
    go.textContent = "↗";
    a.append(time, kind, title, go);
    li.append(a);
    return li;
  });
  list.replaceChildren(...rows);
}

async function load() {
  const cached = readCache();
  if (cached) {
    render(cached.items);
    status.textContent = "Live from GitHub (cached for this visit).";
    return;
  }
  status.textContent = "Checking GitHub for new write-ups…";
  try {
    const items = await fetchLatest();
    writeCache(items);
    render(items);
    status.textContent = "Live from GitHub.";
  } catch {
    status.textContent = "Showing a saved list: GitHub could not be reached just now.";
  }
}

if (list && status) {
  if ("IntersectionObserver" in window) {
    // only spend an API request on visitors who actually scroll towards the section
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(list);
  } else {
    load();
  }
}
