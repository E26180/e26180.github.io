// The mini terminal. A native <dialog> (focus is trapped and Escape closes it), a role="log"
// output and an input with history and Tab completion. Everything it prints is also on the page,
// and the lab results are read from the lab cards so there is one source of truth.

const dialog = document.getElementById("terminal");
const log = document.getElementById("terminal-log");
const input = document.getElementById("terminal-cmd");

const COMMANDS = ["help", "whoami", "ls projects", "cat about", "labs", "contact", "clear", "exit"];
const history = [];
let historyAt = 0;
let opener = null;

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function link(text, href) {
  const a = el("a", text);
  a.href = href;
  if (/^https?:/.test(href) && new URL(href, location.href).origin !== location.origin) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.append(el("span", " (opens in a new tab)", "sr-only"));
  }
  return a;
}

function print(...parts) {
  const p = el("p");
  parts.forEach((part) => p.append(typeof part === "string" ? document.createTextNode(part) : part));
  log.append(p);
  return p;
}

const text = (sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, " ").trim() ?? "";

const run = {
  help() {
    print("Commands:");
    [
      ["whoami", "who I am, in one line"],
      ["ls projects", "my projects, with links"],
      ["cat about", "direction, languages and interests"],
      ["labs", "the four network labs and their results"],
      ["contact", "where to find me"],
      ["clear", "clear the screen"],
      ["exit", "close the terminal (or press Esc)"],
    ].forEach(([cmd, what]) => print(`  ${cmd.padEnd(13)}${what}`));
    print("↑/↓ for history, Tab to complete. Everything here is also on the page.").className = "t-dim";
  },
  whoami() {
    print(text("#pitch .typed-ghost"));
    print(text(".status")).className = "t-dim";
  },
  "ls projects"() {
    [
      ["network-and-firewall-lab/", "flagship · home lab, 4 labs so far", "/lab/"],
      ["security-notes/", "public learning log", "#security-notes"],
      ["pusula/", "AI-assisted student productivity app · private beta", "#pusula"],
      ["earlier/", "Daily Wellness Tracker · Shape Management System · CS Maths & Tools", "#work"],
    ].forEach(([name, what, href]) => print(link(name, href), `  ${what}`));
  },
  "cat about"() {
    print(text(".hero-sub"));
    print(`Direction: ${[...document.querySelectorAll(".direction-path li")].map((li) => li.textContent.trim()).join(" → ")}`);
    print(text(".direction-note"));
    print("Languages: Turkish (native), English (fluent)");
    print(`Interests: ${text("#about .facts-text")}`);
    print(link("→ timeline and IYO results", "#timeline"));
  },
  labs() {
    document.querySelectorAll(".lab-row").forEach((row) => {
      const when = row.querySelector(".lab-when")?.textContent.trim();
      const title = row.querySelector(".lab-name")?.textContent.trim();
      const result = row.querySelector(".lab-result")?.textContent.trim();
      print(`${when}  ${title}`).classList.add("t-cmd");
      print(`  ${result}`);
      print("  ", link("details →", row.href));
    });
  },
  contact() {
    print("GitHub    ", link("github.com/E26180", "https://github.com/E26180"));
    print("LinkedIn  ", link("linkedin.com/in/ahmet-ege-baykoz-6897b635b", "https://www.linkedin.com/in/ahmet-ege-baykoz-6897b635b/"));
  },
  clear() {
    log.replaceChildren();
  },
  exit() {
    dialog.close();
  },
  ls() {
    print("Did you mean ", link("ls projects", "#work"), "? Try typing it.");
  },
  sudo() {
    print("Nice try. This is a read-only portfolio, and default deny applies here too.").className = "t-err";
  },
};

function execute(raw) {
  const cmd = raw.trim().replace(/\s+/g, " ");
  const echo = print("");
  echo.className = "t-cmd";
  echo.append(el("span", "ahmet@york:~$ ", "ps1"), cmd);
  if (!cmd) return;
  history.push(cmd);
  historyAt = history.length;
  const key = cmd.toLowerCase();
  const handler = run[key] || (key.startsWith("sudo") ? run.sudo : null);
  if (handler) handler();
  else print(`command not found: ${cmd}. Type help to see the commands.`).className = "t-err";
  log.scrollTop = log.scrollHeight;
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    execute(input.value);
    input.value = "";
  } else if (e.key === "ArrowUp" && history.length) {
    e.preventDefault();
    historyAt = Math.max(0, historyAt - 1);
    input.value = history[historyAt];
  } else if (e.key === "ArrowDown" && history.length) {
    e.preventDefault();
    historyAt = Math.min(history.length, historyAt + 1);
    input.value = history[historyAt] ?? "";
  } else if (e.key === "Tab" && input.value.trim()) {
    const matches = COMMANDS.filter((c) => c.startsWith(input.value.trim().toLowerCase()));
    if (matches.length === 1) {
      e.preventDefault();
      input.value = matches[0];
    } else if (matches.length > 1) {
      e.preventDefault();
      print(matches.join("   ")).className = "t-dim";
      log.scrollTop = log.scrollHeight;
    }
  }
});

// links to sections of the page close the terminal so the section is visible
log.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a || a.target === "_blank") return;
  opener = null; // let focus follow the link to its section instead of returning to the button
  dialog.close();
});

dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close(); // a click on the backdrop
});
dialog.addEventListener("close", () => {
  opener?.focus();
  document.dispatchEvent(new Event("terminal:close"));
});

export function open(from) {
  opener = from || document.activeElement;
  if (!dialog.open) {
    dialog.showModal();
    document.dispatchEvent(new Event("terminal:open"));
  }
  input.focus();
}
