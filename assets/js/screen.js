// What the Mac's display shows, drawn into a canvas that becomes the screen texture.
// First a terminal checks the built-in defences (typed as you scroll), then four windows
// stream: an SSH key being made, the TLS handshake with this site, packets and raw entropy.
// Keys, fingerprints, ports and bytes are random on every visit; nothing here is a real secret.

import { clamp, ease, seg } from "./ease.js";

const C = {
  prompt: "#7ee787",
  text: "#e6edf3",
  out: "#9da7b3",
  dim: "#6e7681",
  cyan: "#79c0ff",
  yellow: "#e3b341",
  green: "#56d364",
};

const PROMPT = "ahmet@mac ~ % ";
const cmd = (text) => [
  [PROMPT, C.prompt],
  [text, C.text],
];
const out = (text, color = C.out) => [[text, color]];

const rand = (n) => Math.floor(Math.random() * n);
const bytes = (n) => Array.from({ length: n }, () => rand(256));
const hex2 = (b) => b.toString(16).padStart(2, "0");

/* ---------- ssh-keygen, with the key's randomart (the "drunken bishop" walk OpenSSH uses) ---------- */

function randomart(fp) {
  const w = 17;
  const h = 9;
  const field = new Array(w * h).fill(0);
  let x = 8;
  let y = 4;
  for (const b of fp) {
    for (let s = 0; s < 8; s += 2) {
      const step = (b >> s) & 3;
      x = clamp(x + (step & 1 ? 1 : -1), 0, w - 1);
      y = clamp(y + (step & 2 ? 1 : -1), 0, h - 1);
      field[y * w + x]++;
    }
  }
  const sym = " .o+=*BOX@%&#/^";
  const rows = [];
  for (let r = 0; r < h; r++) {
    let line = "";
    for (let c = 0; c < w; c++) {
      if (r === 4 && c === 8) line += "S";
      else if (r === y && c === x) line += "E";
      else line += sym[Math.min(field[r * w + c], sym.length - 1)];
    }
    rows.push(line);
  }
  return rows;
}

function* keygen() {
  const fp = bytes(32);
  const b64 = btoa(String.fromCharCode(...fp)).replace(/=+$/, "");
  yield cmd('ssh-keygen -t ed25519 -C "ahmet@mac"');
  yield out("Generating public/private ed25519 key pair.");
  yield out("Enter file in which to save the key (/Users/ahmet/.ssh/id_ed25519):");
  yield out("Enter passphrase (empty for no passphrase):");
  yield out("Enter same passphrase again:");
  yield out("Your identification has been saved in /Users/ahmet/.ssh/id_ed25519");
  yield out("Your public key has been saved in /Users/ahmet/.ssh/id_ed25519.pub");
  yield out("The key fingerprint is:");
  yield [
    [`SHA256:${b64}`, C.cyan],
    [" ahmet@mac", C.out],
  ];
  yield out("The key's randomart image is:");
  yield out("+--[ED25519 256]--+", C.text);
  for (const row of randomart(fp)) yield out(`|${row}|`, C.green);
  yield out("+----[SHA256]-----+", C.text);
}

/* ---------- the TLS handshake with this site (from a real run of the command) ---------- */

function* curl() {
  yield cmd("curl -svo /dev/null https://e26180.github.io/");
  const star = (t, hi) => [
    ["* ", C.dim],
    [t, hi ? C.cyan : C.out],
  ];
  yield star("Connected to e26180.github.io (185.199.109.153) port 443");
  yield star("ALPN: curl offers h2,http/1.1");
  yield star("(304) (OUT), TLS handshake, Client hello (1):", true);
  yield star("(304) (IN), TLS handshake, Server hello (2):", true);
  yield star("(304) (IN), TLS handshake, Certificate (11):", true);
  yield star("(304) (IN), TLS handshake, CERT verify (15):", true);
  yield star("(304) (IN), TLS handshake, Finished (20):", true);
  yield star("(304) (OUT), TLS handshake, Finished (20):", true);
  yield [
    ["* ", C.dim],
    ["SSL connection using ", C.out],
    ["TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256", C.green],
  ];
  yield star("ALPN: server accepted h2");
  yield star(" subject: CN=*.github.io");
  yield star(" issuer: C=US; O=Let's Encrypt");
  yield [
    ["*  ", C.dim],
    ["SSL certificate verify ok.", C.green],
  ];
  yield out("> GET / HTTP/2", C.text);
  yield out("> Host: e26180.github.io", C.text);
  yield out("< HTTP/2 200", C.green);
  yield out("< server: GitHub.com");
  yield out("< content-type: text/html; charset=utf-8");
  yield out("< strict-transport-security: max-age=31556952", C.yellow);
  yield out("< cache-control: max-age=600");
  yield star("Connection #0 to host e26180.github.io left intact");
}

/* ---------- packets: TLS traffic to GitHub Pages, never ending ---------- */

function* tcpdump() {
  yield cmd("sudo tcpdump -i en0 -n tcp port 443");
  yield out("tcpdump: verbose output suppressed, use -v[v]... for full protocol decode", C.dim);
  yield out("listening on en0, link-type EN10MB (Ethernet), snapshot length 524288 bytes", C.dim);
  let port = 50000 + rand(14000);
  let seq = 1;
  let ack = 1;
  let n = 0;
  for (;;) {
    const d = new Date();
    const ts = `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds() * 1000 + rand(1000)).padStart(6, "0")}`;
    const outbound = n % 3 !== 1;
    let flags = outbound ? "[P.]" : "[.]";
    if (n % 40 === 0) {
      port = 50000 + rand(14000);
      seq = 1;
      ack = 1;
      flags = "[S]";
    }
    const len = flags === "[P.]" ? 40 + rand(1400) : 0;
    const src = outbound ? `192.168.1.23.${port}` : "185.199.109.153.443";
    const dst = outbound ? "185.199.109.153.443" : `192.168.1.23.${port}`;
    const range = len ? `seq ${seq}:${seq + len}, ` : "";
    yield [
      [`${ts} `, C.dim],
      ["IP ", C.out],
      [src, outbound ? C.text : C.cyan],
      [" > ", C.dim],
      [dst, outbound ? C.cyan : C.text],
      [`: Flags ${flags}, `, flags === "[S]" ? C.yellow : C.out],
      [`${range}ack ${ack}, win 2048, length ${len}`, C.out],
    ];
    seq += len;
    ack += outbound ? 0 : 1 + rand(900);
    n++;
  }
}

/* ---------- raw entropy ---------- */

function* xxd() {
  yield cmd("xxd -c 16 /dev/urandom");
  for (let off = 0; ; off += 16) {
    const b = bytes(16);
    let hex = "";
    for (let i = 0; i < 16; i += 2) hex += `${hex2(b[i])}${hex2(b[i + 1])} `;
    const ascii = b.map((v) => (v > 31 && v < 127 ? String.fromCharCode(v) : ".")).join("");
    yield [
      [`${off.toString(16).padStart(8, "0")}: `, C.dim],
      [hex, C.green],
      [` ${ascii}`, C.out],
    ];
  }
}

/* ---------- a terminal window that runs one of the programs above ---------- */

class Stream {
  constructor(title, make, { rate, hold = 3, cap = 60 }) {
    Object.assign(this, { title, make, rate, hold, cap });
    this.reset();
  }

  reset() {
    this.lines = [];
    this.gen = this.make();
    this.acc = 0;
    this.wait = 0;
  }

  // prints `rate` lines a second; finished programs pause, then run again with new random data
  tick(dt) {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.reset();
      return;
    }
    this.acc += dt * this.rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      const next = this.gen.next();
      if (next.done) {
        this.wait = this.hold;
        this.acc = 0;
        return;
      }
      this.lines.push(next.value);
      if (this.lines.length > this.cap) this.lines.shift();
    }
  }

  // a full window at once, for the still picture
  fill(count) {
    for (let i = 0; i < count; i++) {
      const next = this.gen.next();
      if (next.done) break;
      this.lines.push(next.value);
    }
  }
}

/* ---------- the defences check, typed as you scroll ---------- */

const CHECKS = [
  ["cmd", "csrutil status"],
  ["out", "System Integrity Protection status: enabled."],
  ["cmd", "fdesetup status"],
  ["out", "FileVault is On."],
  ["cmd", "spctl --status"],
  ["out", "assessments enabled"],
];
const OUT_TICKS = 6;
const CHECK_TICKS = CHECKS.reduce((n, [kind, text]) => n + (kind === "cmd" ? text.length : OUT_TICKS), 0);

function lastLogin() {
  const d = new Date();
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  return `Last login: ${day} ${mon} ${String(d.getDate()).padStart(2, " ")} ${d.toTimeString().slice(0, 8)} on console`;
}

export class Screen {
  constructor({ compact }) {
    this.compact = compact;
    this.w = compact ? 1536 : 2048;
    this.h = Math.round(this.w * 0.649);
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext("2d");
    this.login = lastLogin();
    const all = [
      new Stream("ssh-keygen", keygen, { rate: 9, hold: 2.5 }),
      new Stream("curl", curl, { rate: 11, hold: 3 }),
      new Stream("tcpdump", tcpdump, { rate: 14 }),
      new Stream("xxd", xxd, { rate: 24 }),
    ];
    // a phone shows the screen small, so it gets two windows with bigger text
    this.streams = compact ? [all[0], all[3]] : all;
    this.lastTime = 0;
    this.lastKey = "";
  }

  // p: scroll progress, now: ms, still: no time-based motion. Returns true when the canvas changed.
  draw(p, now, still = false) {
    const typed = Math.round(seg(p, 0.185, 0.282) * CHECK_TICKS);
    const pop = this.streams.map((_, i) => ease(p, 0.29 + i * 0.012, 0.31 + i * 0.012));
    const streaming = pop[0] > 0;
    const key = `${typed}|${pop.map((v) => v.toFixed(2)).join()}`;

    if (streaming && !still) {
      const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;
      if (dt < 1 / 24 && key === this.lastKey) return false; // about 24 updates a second is plenty
      this.lastTime = now;
      for (const s of this.streams) s.tick(dt);
    } else {
      if (key === this.lastKey && !this.dirty) return false;
      this.lastTime = 0;
      if (still && streaming) for (const s of this.streams) if (!s.lines.length) s.fill(40);
    }
    this.lastKey = key;
    this.dirty = false;

    const { ctx, w, h } = this;
    this.wallpaper();
    const checksAlpha = 1 - ease(p, 0.285, 0.305);
    if (checksAlpha > 0) this.checks(typed, checksAlpha, now);
    this.streams.forEach((s, i) => {
      if (pop[i] > 0) this.window(this.cell(i), s, pop[i], now);
    });
    this.menubar();
    // the camera notch
    const nw = w * 0.105;
    const nh = h * 0.032;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect((w - nw) / 2, -nh, nw, nh * 2, nh * 0.45);
    ctx.fill();
    return true;
  }

  wallpaper() {
    const { ctx, w, h } = this;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0a1020");
    g.addColorStop(0.55, "#0b1730");
    g.addColorStop(1, "#06121f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = ctx.createRadialGradient(w * 0.72, h * 0.28, 0, w * 0.72, h * 0.28, w * 0.6);
    r.addColorStop(0, "rgba(93, 201, 242, 0.22)");
    r.addColorStop(1, "rgba(93, 201, 242, 0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
  }

  menubar() {
    const { ctx, w, h } = this;
    const mh = h * 0.03;
    ctx.fillStyle = "rgba(10, 14, 22, 0.72)";
    ctx.fillRect(0, 0, w, mh);
    const fs = mh * 0.52;
    ctx.textBaseline = "middle";
    ctx.font = `600 ${fs}px "Geist", system-ui, sans-serif`;
    ctx.fillStyle = "#e6edf3";
    let x = w * 0.016;
    ctx.fillText("Terminal", x, mh / 2);
    x += ctx.measureText("Terminal").width + fs * 1.3;
    ctx.font = `400 ${fs}px "Geist", system-ui, sans-serif`;
    for (const item of ["Shell", "Edit", "View", "Window", "Help"]) {
      ctx.fillText(item, x, mh / 2);
      x += ctx.measureText(item).width + fs * 1.3;
    }
    const d = new Date();
    const clock = `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}  ${d.toTimeString().slice(0, 5)}`;
    ctx.textAlign = "right";
    ctx.fillText(clock, w * 0.984, mh / 2);
    ctx.textAlign = "left";
  }

  cell(i) {
    const { w, h, compact } = this;
    const top = h * 0.03;
    const m = w * 0.011;
    const cols = 2;
    const rows = compact ? 1 : 2;
    const cw = (w - m * (cols + 1)) / cols;
    const ch = (h - top - m * (rows + 1)) / rows;
    const c = i % cols;
    const r = Math.floor(i / cols);
    return { x: m + c * (cw + m), y: top + m + r * (ch + m), w: cw, h: ch };
  }

  frame(box, title, alpha, scale = 1) {
    const { ctx } = this;
    const fs = this.fontSize(false);
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    const bar = fs * 1.7;
    ctx.fillStyle = "rgba(13, 17, 23, 0.95)";
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, fs * 0.7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, bar);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, k) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(box.x + fs * (1.1 + k * 1.05), box.y + bar / 2, fs * 0.36, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = C.dim;
    ctx.font = `500 ${fs * 0.8}px "Geist", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`ahmet — ${title}`, cx, box.y + bar / 2);
    ctx.textAlign = "left";
    ctx.beginPath();
    ctx.rect(box.x, box.y + bar, box.w, box.h - bar);
    ctx.clip();
    return { x: box.x + fs * 0.8, y: box.y + bar + fs * 0.5, w: box.w - fs * 1.6, h: box.h - bar - fs * 0.9 };
  }

  fontSize(big) {
    if (this.compact) return big ? 44 : 30;
    return big ? 36 : 19;
  }

  lines(area, lines, fs, cursor, now) {
    const { ctx } = this;
    const lh = fs * 1.42;
    const fit = Math.max(1, Math.floor(area.h / lh));
    const shown = lines.slice(-fit);
    ctx.font = `400 ${fs}px "Geist Mono", ui-monospace, Menlo, monospace`;
    ctx.textBaseline = "top";
    let y = area.y;
    let x = area.x;
    for (const line of shown) {
      x = area.x;
      for (const [text, color] of line) {
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      }
      y += lh;
    }
    if (cursor && Math.floor(now / 530) % 2 === 0) {
      ctx.fillStyle = "rgba(230, 237, 243, 0.85)";
      ctx.fillRect(x + 2, y - lh + fs * 0.08, fs * 0.58, fs * 1.1);
    }
  }

  checks(typed, alpha, now) {
    const { w, h } = this;
    const box = { x: w * 0.06, y: h * 0.08, w: w * 0.88, h: h * 0.84 };
    const area = this.frame(box, "zsh — 120×40", alpha);
    const lines = [out(this.login, C.out)];
    let left = typed;
    let open = true;
    for (const [kind, text] of CHECKS) {
      if (left <= 0) break;
      if (kind === "cmd") {
        lines.push(cmd(text.slice(0, left)));
        open = left < text.length;
        left -= text.length;
      } else {
        lines.push(out(text, C.green));
        open = false;
        left -= OUT_TICKS;
      }
    }
    if (!open) lines.push(cmd(""));
    this.lines(area, lines, this.fontSize(true), true, now);
    this.ctx.restore();
  }

  window(box, stream, alpha, now) {
    const area = this.frame(box, stream.title, alpha, 0.94 + 0.06 * alpha);
    const lines = stream.lines.length ? stream.lines : [cmd("")];
    this.lines(area, lines, this.fontSize(false), stream.wait > 0 || !stream.lines.length, now);
    this.ctx.restore();
  }
}
