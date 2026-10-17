// Inside the Mac, in WebGL. A stylised 14-inch laptop built from simple shapes (no model files),
// lit by three.js's generated studio environment. inside.js owns the scroll and calls update(p);
// this module turns p (0..1) into a camera move, a lid angle, an exploded view and a screen.
// Proportions are roughly right, the internals are an illustration, not any real board.

import * as T from "/assets/vendor/three.min.js";
import { ease, lerp } from "./ease.js";
import { Screen } from "./screen.js";

const W = 31.26; // footprint in cm
const D = 22.12;
const BASE_H = 0.95;
const LID_H = 0.58;
const R = 1.05; // corner radius seen from above
const HINGE_Z = -D / 2 + 0.32;
// exploded positions [up, back]: a staircase, so each layer stays visible under the next one;
// the display stays hinged to the top case, as in a real laptop
const LIFT = { battery: [4.2, 0], board: [8.6, -2], deck: [14.2, -12] };
const DATA_DECK = [3, -8]; // the top case steps further back so the board is clear while the data moves
const SCREEN_W = 30.0;
const SCREEN_H = SCREEN_W * 0.649;
const SCREEN_Z = D - 0.32 - 0.62 - SCREEN_H / 2; // centre of the panel, measured from the hinge
const OPEN = (112 * Math.PI) / 180;

const U = 1.72; // key pitch
const GAP = 0.22;
const KW = 15 * U;
const KZ0 = -D / 2 + 1.25;
const ACCENT = 0x5dc9f2;

/* ---------- shapes ---------- */

function rrect(w, d, r) {
  const s = new T.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// a rounded slab lying flat: footprint w x d, from y = 0 up to y = h, with softened edges
function slab(w, d, h, r, b = 0.06, curve = 10) {
  const g = new T.ExtrudeGeometry(rrect(w - 2 * b, d - 2 * b, Math.max(0.01, r - b)), {
    depth: Math.max(0.001, h - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: curve,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  return g;
}

// the bottom case: a floor plus a rim
function trayRim(w, d, h, r, wall) {
  const outer = rrect(w - 0.1, d - 0.1, r - 0.05);
  outer.holes.push(rrect(w - 2 * wall, d - 2 * wall, Math.max(0.1, r - wall)));
  const g = new T.ExtrudeGeometry(outer, { depth: h - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.05, 0);
  return g;
}

// map a canvas onto the top face of a slab of footprint w x d (the caps use shape coordinates as UVs)
function capTexture(canvas, w, d) {
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.repeat.set(1 / w, 1 / d);
  t.offset.set(0.5, 0.5);
  t.anisotropy = 8;
  return t;
}

function canvas(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  return c;
}

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- textures ---------- */

function deckCanvas() {
  const cw = 2048;
  const ch = Math.round((cw * D) / W);
  const px = (x) => ((x + W / 2) / W) * cw;
  const pz = (z) => ((z + D / 2) / D) * ch;
  return canvas(cw, ch, (g) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, cw, ch);
    // keyboard well
    g.fillStyle = "#26282c";
    g.beginPath();
    g.roundRect(px(-KW / 2 - 0.22), pz(KZ0 - 0.22), px(KW / 2 + 0.22) - px(-KW / 2 - 0.22), pz(KZ0 + 6 * U + 0.0) - pz(KZ0 - 0.22), 18);
    g.fill();
    // speaker grilles
    g.fillStyle = "#4a4d53";
    for (const side of [-1, 1]) {
      for (let x = 13.45; x <= 14.75; x += 0.21) {
        for (let z = KZ0 + 0.1; z <= KZ0 + 6 * U - 0.2; z += 0.21) {
          g.beginPath();
          g.arc(px(side * x), pz(z), 3.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // trackpad
    g.fillStyle = "#f6f7f9";
    g.strokeStyle = "#a3a7ad";
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(px(-7.7), pz(1.05), px(7.7) - px(-7.7), pz(10.4) - pz(1.05), 34);
    g.fill();
    g.stroke();
  });
}

function boardCanvas(bw, bd) {
  const cw = 1024;
  const ch = Math.round((cw * bd) / bw);
  const r = rng(7);
  return canvas(cw, ch, (g) => {
    g.fillStyle = "#0d1512";
    g.fillRect(0, 0, cw, ch);
    g.lineCap = "round";
    for (let i = 0; i < 140; i++) {
      g.strokeStyle = r() > 0.75 ? "#2c4a3d" : "#1a2e26";
      g.lineWidth = 1 + r() * 2.5;
      let x = r() * cw;
      let y = r() * ch;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (k % 2 === 0) x += (r() - 0.5) * 260;
        else y += (r() - 0.5) * 160;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = "#8f7a43";
    for (let i = 0; i < 90; i++) g.fillRect(r() * cw, r() * ch, 3 + r() * 5, 2 + r() * 3);
  });
}

function cellCanvas() {
  return canvas(512, 244, (g, w, h) => {
    g.fillStyle = "#1c1d20";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#34363b";
    g.lineWidth = 3;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = "#4a4d53";
    g.font = '600 26px "Geist", system-ui, sans-serif';
    g.fillText("Li-ion polymer", 34, 62);
    g.fillRect(34, 90, 180, 4);
    g.fillRect(34, 104, 120, 4);
  });
}

function glowCanvas(stops) {
  return canvas(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([at, col]) => r.addColorStop(at, col));
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

/* ---------- the keyboard layout (a 14-inch Mac's, roughly) ---------- */

const KEY_ROWS = [
  [1.5, ...Array(12).fill(1), "touch"],
  [1, ...Array(12).fill(1), 2],
  [1.5, ...Array(12).fill(1), 1.5],
  [1.75, ...Array(11).fill(1), 2.25],
  [2.25, ...Array(10).fill(1), 2.75],
  [1, 1, 1, 1.25, 5.5, 1.25, 1, "arrows"],
];

function keyLayout() {
  const keys = [];
  let touch = null;
  KEY_ROWS.forEach((row, r) => {
    let x = -KW / 2;
    const z = KZ0 + r * U;
    for (const k of row) {
      if (k === "touch") {
        touch = { x: x + 0.75 * U, z: z + U / 2, w: 1.5 * U - GAP, d: U - GAP };
        x += 1.5 * U;
      } else if (k === "arrows") {
        const hd = U / 2 - GAP * 0.75;
        keys.push({ x: x + U / 2, z: z + U * 0.75, w: U - GAP, d: hd });
        keys.push({ x: x + U * 1.5, z: z + U * 0.25, w: U - GAP, d: hd });
        keys.push({ x: x + U * 1.5, z: z + U * 0.75, w: U - GAP, d: hd });
        keys.push({ x: x + U * 2.5, z: z + U * 0.75, w: U - GAP, d: hd });
        x += 3 * U;
      } else {
        keys.push({ x: x + (k * U) / 2, z: z + U / 2, w: k * U - GAP, d: U - GAP });
        x += k * U;
      }
    }
  });
  return { keys, touch };
}

/* ---------- the camera path ---------- */

// target, azimuth and elevation (degrees), the size of the area that should fill the view,
// and pf: how much of that width a tall phone screen keeps (the sides may be cropped a little)
const POSES = {
  intro: { t: [0, 3.2, 0.5], az: -32, el: 24, fw: 48, fh: 29, pf: 0.8 },
  open: { t: [0, 9.5, -6], az: -14, el: 17, fw: 46, fh: 44, pf: 0.84 },
  screen: { t: [0, 0, 0], az: 0, el: 22, fw: SCREEN_W * 1.07, fh: SCREEN_H * 1.16, pf: 0.93 },
  teardown: { t: [0, 11, -7], az: 28, el: 24, fw: 60, fh: 50, pf: 0.8 },
  data: { t: [0, 12, -10], az: 14, el: 26, fw: 50, fh: 38, pf: 0.78 },
  end: { t: [0, 3.2, 0.5], az: -28, el: 22, fw: 48, fh: 29, pf: 0.8 },
};

function mixPose(a, b, k) {
  return {
    t: a.t.map((v, i) => lerp(v, b.t[i], k)),
    az: lerp(a.az, b.az, k),
    el: lerp(a.el, b.el, k),
    fw: lerp(a.fw, b.fw, k),
    fh: lerp(a.fh, b.fh, k),
    pf: lerp(a.pf, b.pf, k),
  };
}

/* ---------- the scene ---------- */

export async function createMac(stage, { compact = false } = {}) {
  try {
    await Promise.all([document.fonts.load('20px "Geist Mono"'), document.fonts.load('600 20px "Geist"')]);
  } catch {
    /* the canvas falls back to system fonts */
  }

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  const el = renderer.domElement;
  el.className = "gl";
  el.setAttribute("aria-hidden", "true");
  stage.prepend(el);

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.95;
  pmrem.dispose();

  const camera = new T.PerspectiveCamera(28, 1, 1, 400);

  const key = new T.DirectionalLight(0xffffff, 1.7);
  key.position.set(14, 34, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new T.DirectionalLight(0x8fd3ff, 0.55);
  rim.position.set(-22, 12, -26);
  scene.add(rim);

  /* materials */
  const anis = renderer.capabilities.getMaxAnisotropy();
  const alu = { color: 0xc5c9cf, metalness: 1, roughness: 0.33 };
  const deckTex = capTexture(deckCanvas(), W, D);
  const BW = 18.4;
  const BD = 8.0;
  const boardTex = capTexture(boardCanvas(BW, BD), BW, BD);
  const cellTex = capTexture(cellCanvas(), 8.4, 4.0);
  [deckTex, boardTex, cellTex].forEach((t) => (t.anisotropy = anis));

  const M = {
    alu: new T.MeshPhysicalMaterial(alu),
    deck: new T.MeshPhysicalMaterial({ ...alu, map: deckTex }),
    key: new T.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.62, metalness: 0.05 }),
    bezel: new T.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }),
    hinge: new T.MeshStandardMaterial({ color: 0x24262a, metalness: 0.7, roughness: 0.38 }),
    pcb: new T.MeshStandardMaterial({ map: boardTex, roughness: 0.5, metalness: 0.15 }),
    chip: new T.MeshStandardMaterial({ color: 0x151619, roughness: 0.42, metalness: 0.1 }),
    substrate: new T.MeshStandardMaterial({ color: 0x2a2f2c, roughness: 0.5, metalness: 0.2 }),
    die: new T.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.12, metalness: 0.3, clearcoat: 1, emissive: ACCENT, emissiveIntensity: 0 }),
    ssd: new T.MeshStandardMaterial({ color: 0x151619, roughness: 0.4, metalness: 0.1, emissive: ACCENT, emissiveIntensity: 0 }),
    shield: new T.MeshStandardMaterial({ color: 0xb8bdc4, metalness: 1, roughness: 0.26, emissive: ACCENT, emissiveIntensity: 0 }),
    touch: new T.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.35, metalness: 0.2, emissive: ACCENT, emissiveIntensity: 0 }),
    copper: new T.MeshStandardMaterial({ color: 0xc9794a, metalness: 1, roughness: 0.3 }),
    black: new T.MeshStandardMaterial({ color: 0x17181b, roughness: 0.55, metalness: 0.08 }),
    fanWall: new T.MeshStandardMaterial({ color: 0x17181b, roughness: 0.55, metalness: 0.08, side: 2 }),
    smd: new T.MeshStandardMaterial({ color: 0x8b7f6c, roughness: 0.6 }),
    cell: new T.MeshStandardMaterial({ map: cellTex, roughness: 0.36, metalness: 0.15 }),
  };

  const mesh = (geo, mat, parent, pos = [0, 0, 0]) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const anchors = {};
  const anchor = (name, parent, pos) => {
    const o = new T.Object3D();
    o.position.set(...pos);
    parent.add(o);
    anchors[name] = o;
  };

  const mac = new T.Group();
  scene.add(mac);
  const G = {};
  for (const name of ["tray", "battery", "board", "deck"]) {
    G[name] = new T.Group();
    mac.add(G[name]);
  }

  /* bottom case */
  mesh(slab(W, D, 0.16, R, 0.06), M.alu, G.tray);
  mesh(trayRim(W, D, 0.8, R, 0.32), M.alu, G.tray);
  anchor("case", G.tray, [-W / 2 + 0.6, 0.5, 6]);

  /* battery and speakers */
  for (const x of [-9.4, 0, 9.4]) for (const z of [2.7, 7.3]) mesh(slab(8.4, 4.0, 0.42, 0.28, 0.05), M.cell, G.battery, [x, 0.17, z]);
  for (const s of [-1, 1]) mesh(slab(1.1, 11, 0.45, 0.2, 0.05), M.black, G.battery, [s * 14.5, 0.17, 4]);
  anchor("battery", G.battery, [-13.6, 0.5, 2.7]);

  /* logic board, fans, cooling */
  const boardY = 0.3;
  const top = boardY + 0.12;
  mesh(slab(BW, BD, 0.12, 0.5, 0.02), M.pcb, G.board, [0, boardY, -6.5]);
  mesh(slab(4.8, 4.0, 0.06, 0.15, 0.015), M.substrate, G.board, [-0.6, top, -5.6]);
  mesh(slab(2.3, 2.3, 0.09, 0.12, 0.02), M.die, G.board, [-1.6, top + 0.06, -5.6]);
  for (const z of [-6.55, -4.65]) mesh(slab(1.3, 1.6, 0.11, 0.08, 0.02), M.chip, G.board, [0.85, top + 0.06, z]);
  for (const x of [4.3, 6.4]) mesh(slab(1.7, 2.2, 0.1, 0.08, 0.02), M.ssd, G.board, [x, top, -5.6]);
  mesh(slab(2.6, 2.0, 0.17, 0.14, 0.03), M.shield, G.board, [-6.6, top, -4.0]);
  for (const [x, z, w, d] of [
    [-6.4, -7.6, 1.4, 1.4],
    [-3.9, -9.2, 1.0, 0.8],
    [7.9, -8.7, 1.2, 1.2],
    [2.6, -9.3, 1.6, 0.9],
    [-8.2, -3.6, 0.9, 0.9],
    [6.9, -3.7, 1.5, 0.8],
  ])
    mesh(slab(w, d, 0.08, 0.06, 0.015), M.chip, G.board, [x, top, z]);
  {
    // small passives scattered over the free parts of the board
    const r = rng(11);
    const geo = new T.BoxGeometry(0.2, 0.07, 0.11);
    const inst = new T.InstancedMesh(geo, M.smd, 220);
    const m4 = new T.Matrix4();
    const q = new T.Quaternion();
    const busy = [
      [-3.0, 1.8, -7.6, -3.6],
      [3.3, 7.3, -6.8, -4.4],
      [-8.0, -5.2, -5.1, -2.9],
    ];
    let n = 0;
    while (n < 220) {
      const x = (r() - 0.5) * (BW - 1);
      const z = -6.5 + (r() - 0.5) * (BD - 0.8);
      if (busy.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), r() > 0.5 ? 0 : Math.PI / 2);
      m4.compose(new T.Vector3(x, top + 0.035, z), q, new T.Vector3(1, 1, 1));
      inst.setMatrixAt(n++, m4);
    }
    inst.castShadow = true;
    G.board.add(inst);
  }
  // heat pipes and fin stacks
  mesh(slab(6.4, 0.8, 0.12, 0.3, 0.04), M.copper, G.board, [-6.5, 0.62, -6.6]);
  mesh(slab(8.6, 0.8, 0.12, 0.3, 0.04), M.copper, G.board, [6.2, 0.62, -8.2]);
  for (const s of [-1, 1]) mesh(slab(4.4, 1.0, 0.46, 0.12, 0.03), M.copper, G.board, [s * 12.15, 0.18, -10.0]);
  const rotors = [];
  for (const s of [-1, 1]) {
    const fan = new T.Group();
    fan.position.set(s * 12.15, 0.18, -6.6);
    G.board.add(fan);
    mesh(new T.CylinderGeometry(2.85, 2.85, 0.48, 48, 1, true), M.fanWall, fan, [0, 0.24, 0]);
    const floor = mesh(new T.CircleGeometry(2.85, 48), M.black, fan, [0, 0.01, 0]);
    floor.rotation.x = -Math.PI / 2;
    const rotor = new T.Group();
    rotor.position.y = 0.24;
    fan.add(rotor);
    mesh(new T.CylinderGeometry(0.85, 0.85, 0.32, 32), M.hinge, rotor);
    const blades = new T.InstancedMesh(new T.BoxGeometry(1.8, 0.04, 0.34), M.hinge, 30);
    const m4 = new T.Matrix4();
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const q = new T.Quaternion().setFromEuler(new T.Euler(0.5, -a + 0.35, 0, "YXZ"));
      m4.compose(new T.Vector3(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75), q, new T.Vector3(1, 1, 1));
      blades.setMatrixAt(i, m4);
    }
    blades.castShadow = true;
    rotor.add(blades);
    rotors.push(rotor);
  }
  anchor("board", G.board, [-BW / 2, top, -6.5]);
  anchor("fans", G.board, [12.15 + 2.85, 0.5, -6.6]);
  anchor("soc", G.board, [-1.6, top + 0.15, -5.6]);
  anchor("ssd", G.board, [5.35, top + 0.1, -5.6]);
  anchor("wifi", G.board, [-6.6, top + 0.17, -4.0]);

  /* top case: deck, keys, Touch ID */
  mesh(slab(W, D, 0.19, R, 0.07), [M.deck, M.alu], G.deck, [0, 0.76, 0]);
  const { keys, touch } = keyLayout();
  const bySize = new Map();
  for (const k of keys) {
    const id = `${k.w.toFixed(3)}x${k.d.toFixed(3)}`;
    if (!bySize.has(id)) bySize.set(id, []);
    bySize.get(id).push(k);
  }
  const m4 = new T.Matrix4();
  for (const list of bySize.values()) {
    const inst = new T.InstancedMesh(slab(list[0].w, list[0].d, 0.06, 0.17, 0.025, 4), M.key, list.length);
    list.forEach((k, i) => inst.setMatrixAt(i, m4.makeTranslation(k.x, 0.91, k.z)));
    inst.castShadow = true;
    G.deck.add(inst);
  }
  mesh(slab(touch.w, touch.d, 0.06, 0.17, 0.025, 4), M.touch, G.deck, [touch.x, 0.91, touch.z]);
  anchor("keyboard", G.deck, [-KW / 2, 0.97, KZ0 + 3.5 * U]);
  anchor("touchid", G.deck, [touch.x, 0.98, touch.z]);

  /* lid and display, hinged at the back */
  const lid = new T.Group();
  G.deck.add(lid);
  lid.position.set(0, BASE_H + 0.012, HINGE_Z);
  const lidBody = new T.Group();
  lid.add(lidBody);
  mesh(slab(W, D, LID_H, R, 0.1), M.alu, lidBody, [0, 0, D / 2 - 0.32]);
  const bezel = mesh(new T.ShapeGeometry(rrect(W - 0.24, D - 0.24, R - 0.12), 10), M.bezel, lidBody, [0, -0.004, D / 2 - 0.32]);
  bezel.rotation.x = Math.PI / 2;
  const screen = new Screen({ compact });
  const screenTex = new T.CanvasTexture(screen.canvas);
  screenTex.colorSpace = T.SRGBColorSpace;
  screenTex.anisotropy = anis;
  const screenMat = new T.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: 0x000000 });
  const panel = mesh(new T.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat, lidBody, [0, -0.008, SCREEN_Z]);
  panel.rotation.x = Math.PI / 2;
  panel.castShadow = false;
  mesh(new T.CylinderGeometry(0.34, 0.34, W - 7, 24), M.hinge, lidBody, [0, -0.2, -0.02]).rotation.z = Math.PI / 2;
  anchor("display", lidBody, [-SCREEN_W / 2 - 0.1, -0.01, SCREEN_Z - SCREEN_H * 0.2]);
  const screenCentre = new T.Object3D();
  screenCentre.position.set(0, -0.01, SCREEN_Z);
  lidBody.add(screenCentre);

  /* floor: soft contact shadow plus the light's shadow */
  const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
  const blobTex = new T.CanvasTexture(glowCanvas([[0, "rgba(0,0,0,0.55)"], [0.55, "rgba(0,0,0,0.25)"], [1, "rgba(0,0,0,0)"]]));
  const blob = new T.Mesh(new T.PlaneGeometry(W * 1.3, D * 1.45), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.002;
  scene.add(blob);

  /* the data path: keys -> Secure Enclave -> SSD, and out over Wi-Fi (drawn for the exploded view) */
  const paths = new T.Group();
  mac.add(paths);
  const at = (o, [up, back]) => o.position.clone().add(new T.Vector3(0, up, back));
  const P = {
    touch: at(anchors.touchid, [LIFT.deck[0] + DATA_DECK[0], LIFT.deck[1] + DATA_DECK[1]]),
    soc: at(anchors.soc, LIFT.board),
    ssd: at(anchors.ssd, LIFT.board),
    wifi: at(anchors.wifi, LIFT.board),
  };
  const curves = [
    [P.touch, new T.Vector3(8, P.touch.y - 2, -19), new T.Vector3(2, P.soc.y + 3, -11), P.soc],
    [P.soc, new T.Vector3(1.9, P.soc.y + 1.6, P.soc.z), P.ssd],
    [P.soc, new T.Vector3(-4.2, P.soc.y + 1.5, -7), P.wifi],
    [P.wifi, new T.Vector3(-8, P.wifi.y + 4, -11), new T.Vector3(-9.5, P.wifi.y + 7, -21), new T.Vector3(-12, P.wifi.y + 15, -30)],
  ].map((pts) => new T.CatmullRomCurve3(pts));
  const tubeMat = new T.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (const c of curves) paths.add(new T.Mesh(new T.TubeGeometry(c, 80, 0.045, 8), tubeMat));
  const glowTex = new T.CanvasTexture(glowCanvas([[0, "rgba(200,240,255,1)"], [0.25, "rgba(93,201,242,0.8)"], [1, "rgba(93,201,242,0)"]]));
  const pulses = [];
  curves.forEach((c, i) => {
    for (let k = 0; k < 3; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false }));
      s.scale.setScalar(i === 3 ? 1.4 : 1.0);
      paths.add(s);
      pulses.push({ s, c, off: k / 3 + i * 0.17, speed: i === 3 ? 0.45 : 0.6 });
    }
  });

  /* ---------- per-frame state ---------- */

  const v = new T.Vector3();
  let width = 1;
  let height = 1;
  let fanAngle = 0;
  let lastNow = 0;

  function resize() {
    width = stage.clientWidth || 1;
    height = stage.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();

  function pose(p) {
    let c = POSES.intro;
    c = mixPose(c, POSES.open, ease(p, 0.05, 0.16));
    c = mixPose(c, { ...POSES.screen, t: screenCentre.getWorldPosition(v).toArray() }, ease(p, 0.15, 0.24));
    c = mixPose(c, POSES.teardown, ease(p, 0.44, 0.56));
    c = mixPose(c, POSES.data, ease(p, 0.665, 0.73));
    c = mixPose(c, POSES.teardown, ease(p, 0.83, 0.87));
    c = mixPose(c, POSES.end, ease(p, 0.87, 0.97));
    return c;
  }

  function place(c) {
    const vf = T.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const fw = camera.aspect < 0.8 ? c.fw * c.pf : c.fw;
    const dist = Math.max(c.fh / 2 / Math.tan(vf / 2), fw / 2 / Math.tan(hf / 2));
    const az = T.MathUtils.degToRad(c.az);
    const el = T.MathUtils.degToRad(c.el);
    const [tx, ty, tz] = c.t;
    camera.position.set(tx + dist * Math.cos(el) * Math.sin(az), ty + dist * Math.sin(el), tz + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
  }

  // the lid opens, the screen wakes, the machine comes apart and goes back together
  function apply(p, now, still) {
    const back = 1 - ease(p, 0.85, 0.93);
    const exB = ease(p, 0.5, 0.6) * back;
    const exBoard = ease(p, 0.515, 0.615) * back;
    const exDeck = ease(p, 0.49, 0.62) * back;
    G.battery.position.set(0, LIFT.battery[0] * exB, LIFT.battery[1] * exB);
    G.board.position.set(0, LIFT.board[0] * exBoard, LIFT.board[1] * exBoard);
    const step = ease(p, 0.665, 0.72) * (1 - ease(p, 0.83, 0.86));
    G.deck.position.set(0, LIFT.deck[0] * exDeck + DATA_DECK[0] * step, LIFT.deck[1] * exDeck + DATA_DECK[1] * step);
    lid.rotation.x = -OPEN * ease(p, 0.05, 0.16) * (1 - ease(p, 0.905, 0.965));
    blob.material.opacity = 1 - 0.5 * exDeck;
    // floating parts would throw shadows far behind the case; on a light page they read as a grey box
    ground.material.opacity = 0.22 * (1 - 0.9 * exDeck);

    const on = ease(p, 0.1, 0.16) * (1 - ease(p, 0.9, 0.95));
    screenMat.color.setScalar(on);
    if (on > 0 && screen.draw(p, now, still)) screenTex.needsUpdate = true;

    const data = ease(p, 0.67, 0.72) * (1 - ease(p, 0.83, 0.855));
    const glow = data * (0.75 + (still ? 0 : 0.25 * Math.sin(now / 260)));
    M.die.emissiveIntensity = glow * 1.4;
    M.ssd.emissiveIntensity = glow * 0.9;
    M.shield.emissiveIntensity = glow * 0.35;
    M.touch.emissiveIntensity = glow * 1.2;
    tubeMat.opacity = data * 0.55;
    paths.visible = data > 0.001;
    for (const pl of pulses) {
      const u = still ? (pl.off % 1) : (now / 1000 * pl.speed + pl.off) % 1;
      pl.c.getPointAt(u, pl.s.position);
      pl.s.material.opacity = data * Math.sin(Math.PI * u);
    }

    const dt = lastNow && !still ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    lastNow = now;
    fanAngle += dt * (2 + 10 * Math.max(exBoard, data));
    for (const r of rotors) r.rotation.y = fanAngle;

    place(pose(p));
    renderer.render(scene, camera);
  }

  return {
    canvas: el,
    resize,
    update(p, now = performance.now(), still = false) {
      apply(p, now, still);
    },
    // anything on screen that moves with time rather than with the scroll
    animating(p) {
      return p > 0.1 && p < 0.95;
    },
    // where a named part is on screen, in CSS pixels relative to the stage
    project(name) {
      const o = anchors[name];
      if (!o) return null;
      o.getWorldPosition(v).project(camera);
      return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, behind: v.z > 1 };
    },
  };
}
