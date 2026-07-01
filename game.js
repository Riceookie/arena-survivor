// ===== Arena Survivor =====
// Gra 2D roguelite: poziomy z falami, portal do następnego poziomu,
// wrogowie z unikalnymi mechanikami, ulepszenia, pułapki, animacje.
// PC (WASD) + telefon (dynamiczny joystick).

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --- HUD ---
const timeEl = document.getElementById("time");
const killsEl = document.getElementById("kills");
const glevelEl = document.getElementById("glevel");
const waveEl = document.getElementById("wave");
const waveMaxEl = document.getElementById("waveMax");
const levelEl = document.getElementById("level");
const healthFill = document.getElementById("healthfill");
const hpTextEl = document.getElementById("hptext");
const xpFill = document.getElementById("xpfill");
const coinsEl = document.getElementById("coins");
const comboEl = document.getElementById("combo");

// --- Ekrany ---
const startScreen = document.getElementById("start");
const gameoverScreen = document.getElementById("gameover");
const levelupScreen = document.getElementById("levelup");
const cardsEl = document.getElementById("cards");
const lvlNumEl = document.getElementById("lvlNum");
const restartBtn = document.getElementById("restartBtn");
const bestEl = document.getElementById("best");
const statsBoxEl = document.getElementById("statsBox");
const statsChart = document.getElementById("statsChart");
const shopScreen = document.getElementById("shop");
const shopItemsEl = document.getElementById("shopItems");
const shopCoinsEl = document.getElementById("shopCoins");
const shopNextBtn = document.getElementById("shopNext");

// --- Joystick ---
const joystickEl = document.getElementById("joystick");
const stickEl = document.getElementById("stick");

// ===== Wczytanie sprite'ów =====
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function makeTint(img, color) {
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = img.width || 64;
  c.height = img.height || 64;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
let S = {}; // sprite'y
let SR = {}; // czerwone sylwetki wrogów

// ===== Widok / skalowanie =====
const view = { w: 0, h: 0 };
function resize() {
  const dpr = window.devicePixelRatio || 1;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.floor(view.w * dpr);
  canvas.height = Math.floor(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

// ===== Typy wrogów (każdy z inną mechaniką) =====
const ENEMY_TYPES = {
  small:    { sprite: "small_enemy",    r: 15, hp: 1,  speed: 108, xp: 1, dmg: 6,  behavior: "chaser" },
  normal:   { sprite: "normal_enemy",   r: 23, hp: 3,  speed: 68,  xp: 2, dmg: 10, behavior: "chaser" },
  big:      { sprite: "big_enemy",      r: 34, hp: 7,  speed: 44,  xp: 4, dmg: 18, behavior: "chaser" },
  spider:   { sprite: "spider_enemy",   r: 18, hp: 2,  speed: 95,  xp: 3, dmg: 8,  behavior: "zigzag" },
  slime:    { sprite: "slime_enemy",    r: 22, hp: 4,  speed: 52,  xp: 3, dmg: 10, behavior: "trail" },
  lizard:   { sprite: "lizard_enemy",   r: 20, hp: 3,  speed: 165, xp: 3, dmg: 10, behavior: "stopgo" },
  creature: { sprite: "creature_enemy", r: 22, hp: 3,  speed: 104, xp: 4, dmg: 10, behavior: "chaser" },
  fish:     { sprite: "fish_enemy",     r: 22, hp: 3,  speed: 88,  xp: 4, dmg: 10, behavior: "zigzag" },
  ghost:    { sprite: "ghost_enemy",    r: 20, hp: 3,  speed: 82,  xp: 4, dmg: 10, behavior: "phase" },
  shooter:  { sprite: "shooting_enemy", r: 22, hp: 3,  speed: 50,  xp: 5, dmg: 8,  behavior: "shooter" },
  dino:     { sprite: "dino_enemy",     r: 26, hp: 5,  speed: 60,  xp: 5, dmg: 14, behavior: "charger" },
  demon:    { sprite: "demon_enemy",    r: 22, hp: 4,  speed: 92,  xp: 5, dmg: 12, behavior: "exploder" },
  golem:    { sprite: "golem_enemy",    r: 36, hp: 15, speed: 32,  xp: 6, dmg: 22, behavior: "tank" },
  robot:    { sprite: "robot_enemy",    r: 30, hp: 11, speed: 46,  xp: 6, dmg: 16, behavior: "tank" },
  devourer: { sprite: "devourer_enemy", r: 24, hp: 6,  speed: 55,  xp: 6, dmg: 14, behavior: "devour" },
  bug:      { sprite: "bug_enemy",      r: 26, hp: 9,  speed: 40,  xp: 5, dmg: 14, behavior: "tank" },
};

// jakie typy dostępne na danym poziomie (rosnąca różnorodność)
function typePool(level) {
  const p = ["small", "normal", "big", "spider"];
  if (level >= 2) p.push("slime", "lizard", "creature");
  if (level >= 3) p.push("ghost", "shooter", "fish");
  if (level >= 4) p.push("dino", "demon", "golem", "bug");
  if (level >= 5) p.push("robot", "devourer");
  return p;
}

const FLASH = 0.18;

// tła zależne od poziomu (stonowane, średnie tony)
const BG = [
  ["#26374f", "#111c2e"], // niebieski
  ["#3a2f4d", "#1a1526"], // fiolet
  ["#2f4a3c", "#16241c"], // zielony
  ["#4a3a2c", "#241a12"], // brąz
  ["#3f2f42", "#211421"], // śliwka
  ["#2f434a", "#131f24"], // morski
  ["#4a2f38", "#26131b"], // bordo
  ["#3a3f2f", "#1f2114"], // oliwka
];
function applyBackground(level) {
  const [a, b] = BG[(level - 1) % BG.length];
  canvas.style.background = `radial-gradient(circle at center, ${a} 0%, ${b} 72%)`;
}

// ===== Stan gry =====
let state = null;
let running = false;
let paused = false;
let pauseMenu = false;
let shopOpen = false;
let lastTime = 0;

// wybrana trudność (ustawiana na ekranie startowym)
let difficultyMult = { hp: 1, dmg: 1, speed: 1, coin: 1, name: "Normalny" };

// definicje bossów (każdy inny) – kind steruje atakami
const BOSS_DEFS = [
  { sprite: "boss1", name: "Ognisty Golem", r: 54, hp: 120, speed: 34, color: "#f97316", kind: "fire" },
  { sprite: "boss2", name: "Krwawy Pająk", r: 50, hp: 140, speed: 58, color: "#ef4444", kind: "summon" },
  { sprite: "boss3", name: "Wąż Cienia", r: 48, hp: 130, speed: 130, color: "#a855f7", kind: "charge" },
  { sprite: "boss4", name: "Pradawny Dino", r: 62, hp: 210, speed: 30, color: "#14b8a6", kind: "slam" },
  { sprite: "boss5", name: "Demon Furii", r: 50, hp: 155, speed: 95, color: "#dc2626", kind: "dash" },
  { sprite: "boss6", name: "Czarny Rycerz", r: 50, hp: 175, speed: 55, color: "#cbd5e1", kind: "slash" },
  { sprite: "boss7", name: "Kogut Zagłady", r: 46, hp: 135, speed: 105, color: "#eab308", kind: "eggs" },
];

const EVENT_NAME = { slime: "🟢 Inwazja Slime'ów!", swarm: "🐝 Rój!", night: "🌙 Noc — uważaj!" };

const pauseBtn = document.getElementById("pauseBtn");
const pauseScreen = document.getElementById("pause");
const resumeBtn = document.getElementById("resumeBtn");
const soundBtn = document.getElementById("soundBtn");
const quitBtn = document.getElementById("quitBtn");

function newState() {
  return {
    player: {
      x: view.w / 2, y: view.h / 2, r: 22, speed: 230,
      hp: 100, maxHp: 100, xp: 0, xpNext: 5, level: 1,
      invuln: 0, puddleCd: 0, pickupRange: 0, regen: 0,
    },
    shopBought: {},
    sword: { count: 1, damage: 1, orbit: 54, rotSpeed: 5, hitR: 26, sprite: "sword" },
    angle: 0,
    abil: {
      gun: { lvl: 0, cd: 0 },
      bomb: { lvl: 0, cd: 0 },
      shield: { lvl: 0, cd: 0 },
      fireball: { lvl: 0, cd: 0 },
      freeze: { lvl: 0, cd: 0 },
      tornado: { lvl: 0, cd: 0 },
      flower: { lvl: 0, cd: 0 },
      car: { lvl: 0, cd: 0 },
      flail: { lvl: 0 },
      magnet: { lvl: 0 },
    },
    flailAngle: 0,
    enemies: [],
    bullets: [],
    fireballs: [],
    bombs: [],
    effects: [],
    pickups: [],
    puddles: [],
    flowers: [],
    tornadoes: [],
    cars: [],
    particles: [],
    obstacles: [],
    enemyBullets: [],
    portal: null,
    transition: null,
    aimAng: 0,
    banner: null,
    hurtFlash: 0,
    prevHp: 100,
    monkeyKills: 0,
    monkeyCd: 18,
    foodCd: 12,
    shake: 0,
    freeze: 0,
    glevel: 1,
    wave: 1,
    wavesInLevel: 3,
    toSpawn: 0,
    spawnTimer: 0,
    waveDelay: 0,
    flowerCd: 3,
    time: 0,
    kills: 0,
    pendingLevelUps: 0,
    over: false,
    // waluta / kombo / wynik
    coins: 0,
    combo: 0,
    comboTimer: 0,
    score: 0,
    // fazy poziomu i wydarzenia
    levelPhase: "waves", // "waves" | "boss" | "cleared"
    event: null,
    bossName: "",
    // statystyki do ekranu śmierci
    stats: { dmgDealt: 0, dmgBySource: {}, timeline: [], bucket: 0, bucketT: 0 },
  };
}

// ===== Wejście: klawiatura =====
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// ===== Dźwięki (proceduralne, WebAudio – bez plików) =====
let audioCtx = null;
let soundOn = true;
let lastDeath = 0;
function initAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function tone(freq, dur, type, vol, slideTo) {
  if (!soundOn || !audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}
function noise(dur, vol) {
  if (!soundOn || !audioCtx) return;
  const t = audioCtx.currentTime;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g); g.connect(audioCtx.destination); src.start(t);
}
function sfx(kind) {
  if (!soundOn || !audioCtx) return;
  switch (kind) {
    case "shoot": tone(700, 0.08, "square", 0.1, 300); break;
    case "explosion": noise(0.35, 0.3); tone(90, 0.3, "sawtooth", 0.18, 40); break;
    case "pickup": tone(520, 0.1, "sine", 0.2, 880); break;
    case "levelup": tone(523, 0.12, "triangle", 0.22); setTimeout(() => tone(784, 0.16, "triangle", 0.22), 120); break;
    case "death": { const now = performance.now(); if (now - lastDeath < 45) return; lastDeath = now; tone(220, 0.1, "square", 0.09, 110); break; }
    case "portal": tone(200, 0.6, "sawtooth", 0.25, 900); break;
    case "damage": noise(0.15, 0.25); tone(120, 0.18, "sawtooth", 0.2, 60); break;
    case "monkey": tone(900, 0.06, "square", 0.16, 1300); setTimeout(() => tone(1150, 0.06, "square", 0.16, 700), 80); setTimeout(() => tone(800, 0.05, "square", 0.14, 1200), 160); break;
  }
}

// muzyka w tle (prosta proceduralna pętla)
let musicTimer = null, musicStep = 0;
const MSCALE = [220, 262, 294, 349, 392, 440, 523];
function musicNote(freq, dur, vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = "triangle"; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}
function musicStart() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!soundOn || !audioCtx || !running || paused) return;
    const n = MSCALE[(musicStep * 3 + (musicStep % 2 ? 2 : 0)) % MSCALE.length];
    musicNote(n, 0.22, 0.035);
    if (musicStep % 4 === 0) musicNote(n / 2, 0.5, 0.05); // bas
    musicStep++;
  }, 265);
}
function musicStop() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

// ===== Wejście: mysz (celowanie) =====
const mouse = { x: 0, y: 0, active: false };
canvas.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });

// ===== Wejście: dotyk =====
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const JOY_MAX = 55;
canvas.addEventListener("pointerdown", (e) => {
  if (!running || paused || e.pointerType !== "touch") return;
  joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
  joy.dx = 0; joy.dy = 0;
  joystickEl.style.left = e.clientX - 65 + "px";
  joystickEl.style.top = e.clientY - 65 + "px";
  joystickEl.style.bottom = "auto";
  joystickEl.classList.remove("hidden");
  stickEl.style.transform = "translate(0,0)";
});
canvas.addEventListener("pointermove", (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_MAX) { dx = (dx / dist) * JOY_MAX; dy = (dy / dist) * JOY_MAX; }
  joy.dx = dx / JOY_MAX; joy.dy = dy / JOY_MAX;
  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
});
function endJoy(e) {
  if (e.pointerId !== joy.id) return;
  joy.active = false; joy.dx = 0; joy.dy = 0;
  joystickEl.classList.add("hidden");
}
canvas.addEventListener("pointerup", endJoy);
canvas.addEventListener("pointercancel", endJoy);

// ===== Pomocnicze =====
function moveVector() {
  let x = 0, y = 0;
  if (keys["w"] || keys["arrowup"]) y -= 1;
  if (keys["s"] || keys["arrowdown"]) y += 1;
  if (keys["a"] || keys["arrowleft"]) x -= 1;
  if (keys["d"] || keys["arrowright"]) x += 1;
  if (joy.active) { x += joy.dx; y += joy.dy; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}
function nearestEnemy(x, y) {
  let best = null, bd = Infinity;
  for (const e of state.enemies) {
    if (e.passive) continue; // małpa nie jest celem auto-broni
    if (e.alpha !== undefined && e.alpha < 0.5) continue; // duch nietykalny
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function addShake(n) { state.shake = Math.min(14, state.shake + n); }
function spawnParticles(x, y, n, color, spd, life) {
  const ps = state.particles;
  if (ps.length > 320) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (spd || 120) * (0.4 + Math.random() * 0.8);
    ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life || 0.5, max: life || 0.5, color: color || "#fde047", size: 2 + Math.random() * 2 });
  }
}

// ===== Fale / poziomy =====
function difficulty() {
  const g = (state.glevel - 1) * state.wavesInLevel + state.wave;
  return {
    hp: (1 + g * 0.1) * difficultyMult.hp,
    speed: (1 + g * 0.012) * difficultyMult.speed,
    dmg: (1 + g * 0.03) * difficultyMult.dmg,
  };
}
function spawnBoss() {
  const s = state;
  const def = BOSS_DEFS[(s.glevel - 1) % BOSS_DEFS.length];
  const hp = Math.round(def.hp * (1 + (s.glevel - 1) * 0.35) * difficultyMult.hp);
  s.enemies.push({
    type: "boss", isBoss: true, kind: def.kind, def,
    behavior: "boss", boss: true, passive: false,
    x: view.w / 2, y: 100, r: def.r,
    baseSpeed: def.speed * difficultyMult.speed, speed: def.speed * difficultyMult.speed,
    hp, maxHp: hp, xp: 45, dmg: Math.round(26 * difficultyMult.dmg),
    hitCd: 0, flailCd: 0, dmgCd: 0, flash: 0, faceFlip: false, seed: 0,
    timer: 0, moving: true, alpha: 1,
    atkCd: 2.5, phase: 1, charging: false, chargeT: 0, cdx: 0, cdy: 0,
  });
  s.bossName = def.name;
  s.banner = { text: "BOSS: " + def.name, t: 2.8, max: 2.8 };
  sfx("portal");
}
function spawnMonkey() {
  const s = state;
  const margin = 60;
  const cx = 120 + Math.random() * (view.w - 240);
  const cy = 130 + Math.random() * (view.h - 220);
  const hp = 8 + s.monkeyKills * 6; // coraz więcej HP po każdym pokonaniu
  s.enemies.push({
    type: "monkey", behavior: "monkey", boss: false, passive: true,
    x: cx - 55, y: cy, r: 22, baseSpeed: 70, speed: 70,
    hp, maxHp: hp, xp: 3, dmg: 0,
    hitCd: 0, flailCd: 0, dmgCd: 0, flash: 0, faceFlip: false, seed: Math.random() * 100,
    cx, cy, orbA: 0, fleeing: false, gone: false, lifeT: 0, fleeAt: 8 + Math.random() * 4,
    timer: 0, moving: true, alpha: 1, chargeCd: 0, charging: false, chargeT: 0, cdx: 0, cdy: 0, shootCd: 0, trailCd: 0,
  });
  sfx("monkey");
}

function genObstacles() {
  const s = state;
  applyBackground(s.glevel);
  s.obstacles = [];
  const count = Math.min(7, 3 + s.glevel);
  let tries = 0;
  while (s.obstacles.length < count && tries < 200) {
    tries++;
    const x = 70 + Math.random() * (view.w - 140);
    const y = 100 + Math.random() * (view.h - 160);
    if (Math.hypot(x - s.player.x, y - s.player.y) < 150) continue; // nie na graczu
    if (s.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 70)) continue; // nie na sobie
    const tree = Math.random() < 0.5;
    const scale = 0.7 + Math.random() * 1.1; // różne rozmiary
    s.obstacles.push({ x, y, r: (tree ? 20 : 24) * scale, scale, type: tree ? "tree" : "rock" });
  }
}
function resolveObstacles(e) {
  for (const o of state.obstacles) {
    let dx = e.x - o.x, dy = e.y - o.y;
    let d = Math.hypot(dx, dy);
    const min = e.r + o.r;
    if (d < min) {
      if (d < 0.001) { dx = 0; dy = -1; d = 1; } // dokładnie w środku -> pchnij w górę
      e.x = o.x + (dx / d) * min;
      e.y = o.y + (dy / d) * min;
    }
  }
}

function startWave() {
  const s = state;
  // wydarzenie specjalne (od 2. poziomu, z pewną szansą)
  s.event = null;
  if (s.glevel >= 2 && Math.random() < 0.28) {
    s.event = ["slime", "swarm", "night"][Math.floor(Math.random() * 3)];
    s.banner = { text: EVENT_NAME[s.event], t: 2.4, max: 2.4 };
  }
  s.toSpawn = 5 + s.wave * 2 + s.glevel * 3;
  if (s.event === "swarm") s.toSpawn = Math.round(s.toSpawn * 1.8);
  s.spawnTimer = 0.3;
}
function nextLevel() {
  const s = state;
  s.glevel++;
  s.wave = 1;
  s.wavesInLevel = 2 + s.glevel;
  s.portal = null;
  s.enemies = [];
  s.enemyBullets = [];
  s.puddles = [];
  s.levelPhase = "waves";
  s.event = null;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp * 0.35);
  s.banner = { text: "POZIOM " + s.glevel, t: 2.2, max: 2.2 };
  genObstacles();
  startWave();
}
function spawnPortal() {
  const m = 120;
  state.portal = {
    x: m + Math.random() * (view.w - 2 * m),
    y: m + Math.random() * (view.h - 2 * m),
    r: 46, spin: 0,
  };
  state.banner = { text: "Wejdź do portalu! →", t: 3, max: 3 };
}

function spawnEnemy(forceType) {
  const s = state;
  const margin = 45;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) (x = Math.random() * view.w), (y = -margin);
  else if (side === 1) (x = view.w + margin), (y = Math.random() * view.h);
  else if (side === 2) (x = Math.random() * view.w), (y = view.h + margin);
  else (x = -margin), (y = Math.random() * view.h);

  let type = forceType;
  if (!type) {
    if (s.event === "slime") type = "slime";
    else if (s.event === "swarm") type = "small";
    else { const pool = typePool(s.glevel); type = pool[Math.floor(Math.random() * pool.length)]; }
  }
  const t = ENEMY_TYPES[type];
  const d = difficulty();
  // elita: rzadka, mocniejsza, świeci i ma gwarantowany drop
  const elite = !forceType && s.glevel >= 2 && Math.random() < 0.06;
  const em = elite ? 2.6 : 1;
  const hp = Math.max(1, Math.round(t.hp * d.hp * em));
  s.enemies.push({
    type, behavior: t.behavior, boss: !!t.boss, isElite: elite,
    x, y, r: t.r * (elite ? 1.18 : 1),
    baseSpeed: t.speed * d.speed * (elite ? 0.9 : 1), speed: t.speed * d.speed * (elite ? 0.9 : 1),
    hp, maxHp: hp, xp: t.xp * (elite ? 3 : 1), dmg: Math.round(t.dmg * d.dmg * (elite ? 1.3 : 1)),
    hitCd: 0, flailCd: 0, dmgCd: 0, flash: 0, faceFlip: false,
    seed: Math.random() * 100,
    timer: 0, moving: true, alpha: 1,
    chargeCd: 1.5 + Math.random(), charging: false, chargeT: 0, cdx: 0, cdy: 0,
    shootCd: 1.2 + Math.random(), trailCd: 0,
  });
}

function damageEnemy(e, dmg) {
  e.hp -= dmg; e.flash = FLASH;
  state.stats.dmgDealt += dmg; state.stats.bucket += dmg;
  spawnParticles(e.x, e.y, 2, "#fde047", 90, 0.3);
}
function recordDmg(src, v) {
  const m = state.stats.dmgBySource;
  m[src] = (m[src] || 0) + v;
}
function createExplosion(x, y, radius, dmg, hurtPlayer, sprite) {
  sfx("explosion");
  state.effects.push({ x, y, r: radius, timer: 0.45, max: 0.45, sprite: sprite || "explosion" });
  addShake(radius > 80 ? 8 : 5);
  for (const e of state.enemies) {
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r) damageEnemy(e, dmg);
  }
  if (hurtPlayer) {
    const p = state.player;
    if (p.invuln <= 0 && Math.hypot(p.x - x, p.y - y) < radius + p.r) {
      p.hp -= dmg;
      p.invuln = Math.max(p.invuln, 0.4);
      recordDmg("wybuch", dmg);
    }
  }
}

// ===== System poziomów gracza =====
function addXp(n) {
  const p = state.player;
  p.xp += n;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = 4 + p.level * 3;
    state.pendingLevelUps++;
  }
}
function upgradePool() {
  const s = state, sw = s.sword, a = s.abil;
  const list = [
    { id: "dmg", icon: "sword.png", title: "Ostry miecz", desc: "+1 obrażeń", lvl: sw.damage, apply: () => (sw.damage += 1) },
    { id: "count", icon: "sword.png", title: "Dodatkowy miecz", desc: "+1 wirujący miecz", lvl: sw.count, show: sw.count < 8, apply: () => (sw.count += 1) },
    { id: "spin", icon: "sword.png", title: "Szybszy miecz", desc: "Szybszy obrót", lvl: Math.round(sw.rotSpeed), apply: () => (sw.rotSpeed += 1.4) },
    { id: "reach", icon: "sword.png", title: "Wielki miecz", desc: "Większy zasięg i obrażenia", lvl: Math.round((sw.orbit - 54) / 18) + 1, apply: () => { sw.orbit += 18; sw.hitR += 10; sw.damage += 1; } },
    { id: "hp", icon: "health.png", title: "Więcej życia", desc: "+25 max HP i leczy", lvl: Math.round(s.player.maxHp / 25), apply: () => { s.player.maxHp += 25; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40); } },
    { id: "speed", icon: "player.png", title: "Szybsze nogi", desc: "+ prędkość ruchu", lvl: Math.round((s.player.speed - 230) / 30) + 1, apply: () => (s.player.speed += 30) },
    { id: "gun", icon: "gun.png", title: a.gun.lvl ? "Lepszy pistolet" : "Pistolet", desc: a.gun.lvl ? "Szybszy ogień" : "Auto-strzela do wrogów", lvl: a.gun.lvl, apply: () => (a.gun.lvl += 1) },
    { id: "bomb", icon: "bomb.png", title: a.bomb.lvl ? "Więcej bomb" : "Bomby", desc: a.bomb.lvl ? "Silniejsze wybuchy" : "Rzuca wybuchające bomby", lvl: a.bomb.lvl, apply: () => (a.bomb.lvl += 1) },
    { id: "shield", icon: "shield.png", title: a.shield.lvl ? "Lepsza tarcza" : "Tarcza", desc: a.shield.lvl ? "Częstsza ochrona" : "Cyklicznie chroni", lvl: a.shield.lvl, apply: () => (a.shield.lvl += 1) },
    { id: "fireball", icon: "firball.png", title: a.fireball.lvl ? "Większa kula ognia" : "Kula ognia", desc: a.fireball.lvl ? "Silniejsze pociski" : "Przebijające kule ognia", lvl: a.fireball.lvl, apply: () => (a.fireball.lvl += 1) },
    { id: "freeze", icon: "freeze.png", title: a.freeze.lvl ? "Lepsze zamrożenie" : "Zamrożenie", desc: a.freeze.lvl ? "Częstsze / dłuższe" : "Cyklicznie zamraża wrogów", lvl: a.freeze.lvl, apply: () => (a.freeze.lvl += 1) },
    { id: "tornado", icon: "tornado.png", title: a.tornado.lvl ? "Większe tornado" : "Tornado", desc: a.tornado.lvl ? "Częstsze, silniejsze" : "Wzywa tornado tnące wrogów", lvl: a.tornado.lvl, apply: () => (a.tornado.lvl += 1) },
    { id: "flower", icon: "flower.png", title: a.flower.lvl ? "Więcej kwiatów" : "Wybuchowe kwiaty", desc: a.flower.lvl ? "Częstsze, silniejsze" : "Sadzi wybuchające kwiaty przy wrogach", lvl: a.flower.lvl, apply: () => (a.flower.lvl += 1) },
    { id: "car", icon: "car.png", title: a.car.lvl ? "Szybsze auto" : "Auto", desc: a.car.lvl ? "Częstsze przejazdy" : "Auto przejeżdża i rozjeżdża wrogów", lvl: a.car.lvl, apply: () => (a.car.lvl += 1) },
    { id: "flail", icon: "spiked_ball.png", title: a.flail.lvl ? "Cięższa kula" : "Kolczasta kula", desc: a.flail.lvl ? "Więcej kul / obrażeń" : "Kula na łańcuchu krąży i miażdży", lvl: a.flail.lvl, show: a.flail.lvl < 3, apply: () => (a.flail.lvl += 1) },
    { id: "magnet", icon: "magnet.png", title: a.magnet.lvl ? "Silniejszy magnes" : "Magnes", desc: a.magnet.lvl ? "Większy zasięg zbierania" : "Przyciąga jedzenie i skrzynie", lvl: a.magnet.lvl, apply: () => (a.magnet.lvl += 1) },
  ];
  return list.filter((u) => u.show !== false);
}
function openLevelUp() {
  paused = true;
  sfx("levelup");
  lvlNumEl.textContent = state.player.level;
  const pool = upgradePool();
  const chosen = [];
  while (chosen.length < 3 && pool.length) {
    chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  cardsEl.innerHTML = "";
  chosen.forEach((u, i) => {
    const card = document.createElement("button");
    card.className = "upgrade-card";
    card.style.animationDelay = i * 0.08 + "s";
    card.innerHTML = `
      <div class="u-icon"><img src="assets/${u.icon}" alt="" /></div>
      <div class="u-body">
        <div class="u-title">${u.title}</div>
        <div class="u-desc">${u.desc}</div>
      </div>
      ${u.lvl ? `<div class="u-lvl">Lvl ${u.lvl}</div>` : `<div class="u-lvl u-new">NOWE</div>`}
    `;
    card.addEventListener("click", () => {
      u.apply();
      state.pendingLevelUps--;
      levelupScreen.classList.add("hidden");
      if (state.pendingLevelUps > 0) openLevelUp();
      else { paused = false; lastTime = performance.now(); }
    });
    cardsEl.appendChild(card);
  });
  levelupScreen.classList.remove("hidden");
}

// ===== Sklep (stałe ulepszenia za monety) =====
const SHOP_ITEMS = [
  { id: "hp", title: "+30 Max HP", desc: "Trwałe zdrowie", base: 15, apply: (p) => { p.maxHp += 30; p.hp += 30; } },
  { id: "dmg", title: "+2 Obrażenia miecza", desc: "Mocniejsza broń", base: 20, apply: (p, s) => { s.sword.damage += 2; } },
  { id: "speed", title: "+20 Prędkość", desc: "Szybszy ruch", base: 15, apply: (p) => { p.speed += 20; } },
  { id: "range", title: "+40 Zasięg zbierania", desc: "Przyciąga przedmioty", base: 12, apply: (p) => { p.pickupRange += 40; } },
  { id: "regen", title: "+1 Regeneracja HP/s", desc: "Powolne leczenie", base: 30, apply: (p) => { p.regen += 1; } },
  { id: "heal", title: "Pełne leczenie", desc: "Ulecz do pełna", base: 10, repeatCost: true, apply: (p) => { p.hp = p.maxHp; } },
];
function buildShop() {
  const s = state, p = s.player;
  shopCoinsEl.textContent = s.coins;
  shopItemsEl.innerHTML = "";
  for (const it of SHOP_ITEMS) {
    const bought = s.shopBought[it.id] || 0;
    const cost = it.repeatCost ? it.base : it.base + bought * it.base;
    const btn = document.createElement("button");
    btn.className = "shop-card";
    btn.disabled = s.coins < cost;
    btn.innerHTML = `<div><div class="s-title">${it.title}</div><div class="s-desc">${it.desc}${bought ? " (x" + bought + ")" : ""}</div></div><div class="s-price">💰 ${cost}</div>`;
    btn.addEventListener("click", () => {
      if (s.coins < cost) return;
      s.coins -= cost; s.shopBought[it.id] = bought + 1;
      it.apply(p, s); sfx("pickup"); buildShop();
    });
    shopItemsEl.appendChild(btn);
  }
}
function openShop() {
  shopOpen = true; paused = true;
  buildShop();
  shopScreen.classList.remove("hidden");
}

// ===== Bossowie =====
function bossShoot(e, ang, speed, dmg, sprite, size) {
  state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, a: ang, dmg, life: 4, sprite, size: size || 30, src: e.def.name });
}
function updateBoss(e, dt, p) {
  const s = state;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  const enraged = e.hp < e.maxHp * 0.5; // faza 2 poniżej połowy HP
  e.phase = enraged ? 2 : 1;
  const spd = e.baseSpeed * (enraged ? 1.35 : 1);
  e.atkCd -= dt;
  e.faceFlip = p.x > e.x;

  switch (e.kind) {
    case "fire": // wachlarz / pierścień ognia
      e.x += nx * spd * 0.35 * dt; e.y += ny * spd * 0.35 * dt;
      if (e.atkCd <= 0) {
        const base = Math.atan2(dy, dx), n = enraged ? 12 : 6;
        for (let i = 0; i < n; i++) { const ang = enraged ? (i / n) * Math.PI * 2 : base + (i - (n - 1) / 2) * 0.22; bossShoot(e, ang, 210, e.dmg * 0.5, "effect7", 34); }
        e.atkCd = enraged ? 1.6 : 2.3;
      }
      break;
    case "summon": // przyzywa pajączki + strzał
      e.x += nx * spd * 0.6 * dt; e.y += ny * spd * 0.6 * dt;
      if (e.atkCd <= 0) {
        for (let i = 0; i < (enraged ? 3 : 2); i++) spawnEnemy("spider");
        bossShoot(e, Math.atan2(dy, dx), 180, e.dmg * 0.4, "effect3", 30);
        e.atkCd = enraged ? 3 : 4.5;
      }
      break;
    case "charge": // szarże + trucizna
      if (e.charging) {
        e.chargeT -= dt; e.x += e.cdx * spd * 2.4 * dt; e.y += e.cdy * spd * 2.4 * dt;
        s.puddles.push({ x: e.x, y: e.y, r: 22, life: 3, max: 3 });
        if (e.chargeT <= 0) { e.charging = false; e.atkCd = enraged ? 1.2 : 2; }
      } else {
        e.x += nx * spd * 0.5 * dt; e.y += ny * spd * 0.5 * dt;
        if (e.atkCd <= 0) { e.charging = true; e.chargeT = 0.7; e.cdx = nx; e.cdy = ny; e.flash = FLASH; }
      }
      break;
    case "slam": // fala uderzeniowa w miejscu gracza
      e.x += nx * spd * dt; e.y += ny * spd * dt;
      if (e.atkCd <= 0) { createExplosion(p.x, p.y, enraged ? 150 : 110, e.dmg * 0.6, true, "effect6"); e.atkCd = enraged ? 2.2 : 3.2; }
      break;
    case "dash": // doskoki + cięcia
      if (e.charging) {
        e.chargeT -= dt; e.x += e.cdx * spd * 3 * dt; e.y += e.cdy * spd * 3 * dt;
        if (e.chargeT <= 0) { e.charging = false; e.atkCd = enraged ? 0.9 : 1.6; }
      } else {
        e.x += nx * spd * 0.7 * dt; e.y += ny * spd * 0.7 * dt;
        if (e.atkCd <= 0) { e.charging = true; e.chargeT = 0.4; e.cdx = nx; e.cdy = ny; e.flash = FLASH; bossShoot(e, Math.atan2(dy, dx), 260, e.dmg * 0.5, "effect8", 34); }
      }
      break;
    case "slash": // łuk cięć + teleport w furii
      e.x += nx * spd * 0.5 * dt; e.y += ny * spd * 0.5 * dt;
      if (e.atkCd <= 0) {
        const base = Math.atan2(dy, dx), n = enraged ? 5 : 3;
        for (let i = 0; i < n; i++) bossShoot(e, base + (i - (n - 1) / 2) * 0.3, 300, e.dmg * 0.5, "effect8", 32);
        if (enraged && Math.random() < 0.5) { e.x = 80 + Math.random() * (view.w - 160); e.y = 80 + Math.random() * (view.h / 2); }
        e.atkCd = enraged ? 1.4 : 2.2;
      }
      break;
    case "eggs": // chaotyczny ruch, przyzywa + spojrzenie
      e.orbA = (e.orbA || 0) + dt * 3;
      e.x += (nx * 0.5 + Math.cos(e.orbA) * 0.6) * spd * dt;
      e.y += (ny * 0.5 + Math.sin(e.orbA) * 0.6) * spd * dt;
      if (e.atkCd <= 0) {
        if (Math.random() < 0.5) { for (let i = 0; i < 2; i++) spawnEnemy("small"); }
        else { const m = enraged ? 6 : 4; for (let i = 0; i < m; i++) bossShoot(e, (i / m) * Math.PI * 2, 190, e.dmg * 0.4, "effect2", 30); }
        e.atkCd = enraged ? 1.8 : 2.8;
      }
      break;
  }
  e.x = Math.max(e.r, Math.min(view.w - e.r, e.x));
  e.y = Math.max(e.r, Math.min(view.h - e.r, e.y));
}

// ===== Zachowania wrogów =====
function updateEnemy(e, dt, p) {
  if (e.behavior === "boss") { updateBoss(e, dt, p); return; }
  // małpa-handlarz: pasywna, krąży w kółko, po chwili ucieka
  if (e.behavior === "monkey") {
    e.lifeT += dt;
    if (!e.fleeing && e.lifeT > e.fleeAt) e.fleeing = true;
    if (e.fleeing) {
      const tx = e.cx < view.w / 2 ? -90 : view.w + 90;
      const dir = tx < e.x ? -1 : 1;
      e.x += dir * e.speed * 1.7 * dt;
      e.faceFlip = dir > 0;
      if (e.x < -80 || e.x > view.w + 80) e.gone = true;
    } else {
      const px = e.x;
      e.orbA += dt * 1.6;
      e.x = e.cx + Math.cos(e.orbA) * 55;
      e.y = e.cy + Math.sin(e.orbA) * 55;
      e.faceFlip = e.x > px;
    }
    return;
  }

  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  let vx = nx * e.speed, vy = ny * e.speed;

  switch (e.behavior) {
    case "zigzag": {
      const px = -ny, py = nx;
      const osc = Math.sin(state.time * 6 + e.seed) * 0.7;
      vx = (nx * 0.8 + px * osc) * e.speed;
      vy = (ny * 0.8 + py * osc) * e.speed;
      break;
    }
    case "stopgo": {
      e.timer -= dt;
      if (e.timer <= 0) { e.moving = !e.moving; e.timer = e.moving ? 0.7 : 0.5; }
      if (!e.moving) { vx = 0; vy = 0; }
      break;
    }
    case "phase": {
      e.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(state.time * 3 + e.seed));
      break;
    }
    case "trail": {
      e.trailCd -= dt;
      if (e.trailCd <= 0) {
        state.puddles.push({ x: e.x, y: e.y, r: 20, life: 4, max: 4 });
        e.trailCd = 0.4;
      }
      break;
    }
    case "shooter": {
      if (d > 240) { /* podchodzi */ }
      else { const px = -ny, py = nx; vx = px * e.speed * 0.6; vy = py * e.speed * 0.6; }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 520) {
        const a = Math.atan2(dy, dx);
        state.enemyBullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
          a, dmg: e.dmg, life: 3,
        });
        e.shootCd = 1.8;
      }
      break;
    }
    case "charger": {
      if (e.charging) {
        e.chargeT -= dt;
        vx = e.cdx * e.baseSpeed * 3.2;
        vy = e.cdy * e.baseSpeed * 3.2;
        if (e.chargeT <= 0) { e.charging = false; e.chargeCd = 2.2; }
      } else {
        vx = nx * e.speed * 0.5; vy = ny * e.speed * 0.5;
        e.chargeCd -= dt;
        if (e.chargeCd <= 0.4) e.flash = FLASH; // telegraf
        if (e.chargeCd <= 0) { e.charging = true; e.chargeT = 0.45; e.cdx = nx; e.cdy = ny; }
      }
      break;
    }
    case "devour": {
      e.speed = Math.min(e.baseSpeed * 2.2, e.speed + dt * 10);
      vx = nx * e.speed; vy = ny * e.speed;
      break;
    }
  }

  e.x += vx * dt;
  e.y += vy * dt;
  e.faceFlip = p.x > e.x; // obrót w stronę gracza (poprawiony kierunek)
}

// ===== Aktualizacja =====
function update(dt) {
  const s = state;
  const p = s.player;
  s.time += dt;

  // przejście między poziomami (portal) → po animacji otwiera sklep
  if (s.transition) {
    s.transition.t -= dt;
    if (s.transition.t <= 0) { s.transition = null; openShop(); }
    return;
  }

  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 30);
  if (s.freeze > 0) s.freeze -= dt;
  if (s.hurtFlash > 0) s.hurtFlash = Math.max(0, s.hurtFlash - dt * 2);
  if (s.comboTimer > 0) { s.comboTimer -= dt; if (s.comboTimer <= 0) s.combo = 0; }
  if (s.banner) { s.banner.t -= dt; if (s.banner.t <= 0) s.banner = null; }
  s.prevHp = p.hp;

  // statystyki: co sekundę zapisz zadane obrażenia (do wykresu DPS)
  s.stats.bucketT += dt;
  if (s.stats.bucketT >= 1) {
    s.stats.timeline.push(s.stats.bucket);
    if (s.stats.timeline.length > 90) s.stats.timeline.shift();
    s.stats.bucket = 0; s.stats.bucketT -= 1;
  }

  // cząsteczki
  for (const pt of s.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92; pt.life -= dt; }
  s.particles = s.particles.filter((pt) => pt.life > 0);

  // ruch gracza
  const mv = moveVector();
  p.x += mv.x * p.speed * dt;
  p.y += mv.y * p.speed * dt;
  p.x = Math.max(p.r, Math.min(view.w - p.r, p.x));
  p.y = Math.max(p.r, Math.min(view.h - p.r, p.y));
  resolveObstacles(p);
  if (p.invuln > 0) p.invuln -= dt;
  if (p.puddleCd > 0) p.puddleCd -= dt;
  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // celowanie: mysz (PC) lub najbliższy wróg (telefon)
  if (mouse.active) s.aimAng = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  else { const t = nearestEnemy(p.x, p.y); if (t) s.aimAng = Math.atan2(t.y - p.y, t.x - p.x); }

  // portal aktywny? sprawdź wejście
  if (s.portal) {
    s.portal.spin += dt * 2.5;
    if (Math.hypot(s.portal.x - p.x, s.portal.y - p.y) < s.portal.r + p.r) {
      s.transition = { t: 1.3, max: 1.3, done: false };
      s.portal = null;
      sfx("portal");
    }
  } else {
    // spawnowanie fali
    if (s.waveDelay > 0) {
      s.waveDelay -= dt;
      if (s.waveDelay <= 0) startWave();
    } else if (s.toSpawn > 0) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        spawnEnemy();
        s.toSpawn--;
        s.spawnTimer = Math.max(0.2, 0.8 - s.glevel * 0.04);
      }
    } else if (s.enemies.filter((e) => !e.passive).length === 0) {
      // fala wyczyszczona (małpy nie liczą się do fali)
      if (s.wave < s.wavesInLevel) { s.wave++; s.waveDelay = 1.5; }
      else if (s.levelPhase === "waves") { s.levelPhase = "boss"; spawnBoss(); }
    }
  }

  // miecze
  s.angle += s.sword.rotSpeed * dt;
  const swords = [];
  for (let i = 0; i < s.sword.count; i++) {
    const a = s.angle + (i * Math.PI * 2) / s.sword.count;
    swords.push({ x: p.x + Math.cos(a) * s.sword.orbit, y: p.y + Math.sin(a) * s.sword.orbit });
  }

  // kolczaste kule na łańcuchu (broń orbitalna, kręcą się w drugą stronę)
  const flails = [];
  if (s.abil.flail.lvl > 0) {
    s.flailAngle -= (3 + s.abil.flail.lvl * 0.3) * dt;
    const cnt = Math.min(3, s.abil.flail.lvl);
    for (let i = 0; i < cnt; i++) {
      const a = s.flailAngle + (i * Math.PI * 2) / cnt;
      flails.push({ x: p.x + Math.cos(a) * 92, y: p.y + Math.sin(a) * 92 });
    }
  }

  // zdolności
  const a = s.abil;
  if (a.gun.lvl > 0) {
    a.gun.cd -= dt;
    if (a.gun.cd <= 0) {
      const ang = s.aimAng; // strzela tam, gdzie celuje pistolet (mysz / wróg)
      s.bullets.push({ x: p.x + Math.cos(ang) * p.r, y: p.y + Math.sin(ang) * p.r, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, dmg: 1 + a.gun.lvl, life: 1.5 });
      a.gun.cd = Math.max(0.22, 0.9 - a.gun.lvl * 0.1);
      sfx("shoot");
    }
  }
  if (a.bomb.lvl > 0) {
    a.bomb.cd -= dt;
    if (a.bomb.cd <= 0) { s.bombs.push({ x: p.x, y: p.y, fuse: 1.0 }); a.bomb.cd = Math.max(2, 5 - a.bomb.lvl * 0.4); }
  }
  if (a.shield.lvl > 0) {
    a.shield.cd -= dt;
    if (a.shield.cd <= 0) { p.invuln = 1.5 + a.shield.lvl * 0.3; a.shield.cd = Math.max(4, 9 - a.shield.lvl) + p.invuln; }
  }
  if (a.fireball.lvl > 0) {
    a.fireball.cd -= dt;
    if (a.fireball.cd <= 0) {
      const t = nearestEnemy(p.x, p.y);
      if (t) {
        const ang = Math.atan2(t.y - p.y, t.x - p.x);
        s.fireballs.push({ x: p.x, y: p.y, vx: Math.cos(ang) * 340, vy: Math.sin(ang) * 340, a: ang, dmg: 3 + a.fireball.lvl * 2, life: 2.2, hit: new Set() });
        a.fireball.cd = Math.max(1.5, 4 - a.fireball.lvl * 0.3);
      }
    }
  }
  if (a.freeze.lvl > 0) {
    a.freeze.cd -= dt;
    if (a.freeze.cd <= 0) { s.freeze = 1.5 + a.freeze.lvl * 0.4; a.freeze.cd = Math.max(5, 12 - a.freeze.lvl) + s.freeze; }
  }
  if (a.tornado.lvl > 0) {
    a.tornado.cd -= dt;
    if (a.tornado.cd <= 0) {
      s.tornadoes.push({ x: p.x, y: p.y, r: 46 + a.tornado.lvl * 6, life: 4 + a.tornado.lvl * 0.6, dmg: 2 + a.tornado.lvl, spin: 0, hitCd: 0 });
      a.tornado.cd = Math.max(3, 8 - a.tornado.lvl * 0.6);
    }
  }
  if (a.flower.lvl > 0) {
    a.flower.cd -= dt;
    if (a.flower.cd <= 0) {
      const t = nearestEnemy(p.x, p.y);
      const fx = t ? t.x : p.x + (Math.random() - 0.5) * 160;
      const fy = t ? t.y : p.y + (Math.random() - 0.5) * 160;
      s.flowers.push({ x: fx, y: fy, state: "arming", t: 0.8, friendly: true, power: 5 + a.flower.lvl * 2, rad: 50 + a.flower.lvl * 8 });
      a.flower.cd = Math.max(2.5, 6 - a.flower.lvl * 0.5);
    }
  }
  if (a.car.lvl > 0) {
    a.car.cd -= dt;
    if (a.car.cd <= 0) {
      // przejeżdża w poprzek areny w kierunku, gdzie jest więcej wrogów
      let left = 0, right = 0;
      for (const e of s.enemies) (e.x < p.x ? left++ : right++);
      const goRight = right >= left;
      const cy = s.enemies.length ? p.y : p.y;
      s.cars.push({
        x: goRight ? -70 : view.w + 70, y: cy,
        vx: (goRight ? 1 : -1) * 560, r: 34,
        dmg: 8 + a.car.lvl * 3, hit: new Set(),
      });
      a.car.cd = Math.max(4, 10 - a.car.lvl * 0.7);
    }
  }

  // kwiaty-pułapki
  s.flowerCd -= dt;
  if (s.flowerCd <= 0 && s.flowers.length < 5) {
    const fx = 60 + Math.random() * (view.w - 120);
    const fy = 90 + Math.random() * (view.h - 150);
    if (Math.hypot(fx - p.x, fy - p.y) > 120) s.flowers.push({ x: fx, y: fy, state: "idle", t: 0, friendly: false });
    s.flowerCd = 3 + Math.random() * 3;
  }

  // małpa-handlarz co jakiś czas (jeśli żadnej nie ma)
  s.monkeyCd -= dt;
  if (s.monkeyCd <= 0) {
    if (!s.enemies.some((e) => e.passive)) spawnMonkey();
    s.monkeyCd = 18 + Math.random() * 14;
  }

  // jedzenie pojawia się od czasu do czasu (nie ciągle – żeby nie leczyć się bez końca)
  s.foodCd -= dt;
  if (s.foodCd <= 0) {
    s.pickups.push({ kind: "food", x: 60 + Math.random() * (view.w - 120), y: 100 + Math.random() * (view.h - 150), r: 14, life: 7 });
    s.foodCd = 16 + Math.random() * 12;
  }
  for (const f of s.flowers) {
    if (f.state === "idle") {
      if (Math.hypot(f.x - p.x, f.y - p.y) < 78) { f.state = "arming"; f.t = 0.7; }
    } else if (f.state === "arming") {
      f.t -= dt;
      if (f.t <= 0) {
        if (f.friendly) createExplosion(f.x, f.y, f.rad, f.power, false);
        else createExplosion(f.x, f.y, 60, 14, true, "bomb_trap_effect");
        f.dead = true;
      }
    }
  }
  s.flowers = s.flowers.filter((f) => !f.dead);

  // tornada (zdolność) – dryfują ku wrogom i tną
  for (const tn of s.tornadoes) {
    tn.life -= dt; tn.spin += dt * 12;
    spawnParticles(tn.x, tn.y, 1, "#e0f2fe", 60, 0.3);
    const t = nearestEnemy(tn.x, tn.y);
    if (t) {
      const dx = t.x - tn.x, dy = t.y - tn.y, d = Math.hypot(dx, dy) || 1;
      tn.x += (dx / d) * 95 * dt; tn.y += (dy / d) * 95 * dt;
    }
    tn.hitCd -= dt;
    if (tn.hitCd <= 0) {
      for (const e of s.enemies) {
        if (e.alpha < 0.5) continue;
        if (Math.hypot(e.x - tn.x, e.y - tn.y) < tn.r + e.r) damageEnemy(e, tn.dmg);
      }
      tn.hitCd = 0.25;
    }
  }
  s.tornadoes = s.tornadoes.filter((tn) => tn.life > 0);

  // auta (zdolność) – przejeżdżają w poprzek i rozjeżdżają wrogów
  for (const c of s.cars) {
    c.x += c.vx * dt;
    spawnParticles(c.x - Math.sign(c.vx) * 34, c.y + 8, 1, "#9ca3af", 40, 0.4);
    for (const e of s.enemies) {
      if (e.alpha < 0.5) continue;
      if (!c.hit.has(e) && Math.hypot(e.x - c.x, e.y - c.y) < c.r + e.r) {
        damageEnemy(e, c.dmg);
        c.hit.add(e);
        e.x += (c.vx > 0 ? 1 : -1) * 30; // odrzut
      }
    }
  }
  s.cars = s.cars.filter((c) => c.x > -100 && c.x < view.w + 100);

  // wrogowie
  const frozen = s.freeze > 0;
  for (const e of s.enemies) {
    e.hitCd -= dt; e.flailCd -= dt; e.dmgCd -= dt;
    if (e.flash > 0) e.flash -= dt;
    if (!frozen) updateEnemy(e, dt, p);
    else if (e.behavior === "phase") e.alpha = 0.6; // widoczny gdy zamrożony
    resolveObstacles(e);

    const inv = e.alpha < 0.5; // duch nietykalny w fazie
    // miecze
    if (!inv) {
      for (const sw of swords) {
        if (e.hitCd <= 0 && Math.hypot(sw.x - e.x, sw.y - e.y) < s.sword.hitR + e.r) {
          damageEnemy(e, s.sword.damage);
          e.hitCd = 0.3;
          const kd = Math.hypot(sw.x - e.x, sw.y - e.y) || 1;
          e.x += ((e.x - sw.x) / kd) * 12; e.y += ((e.y - sw.y) / kd) * 12;
          break;
        }
      }
      // kolczaste kule
      for (const fl of flails) {
        if (e.flailCd <= 0 && Math.hypot(fl.x - e.x, fl.y - e.y) < 30 + e.r) {
          damageEnemy(e, 2 + s.abil.flail.lvl);
          e.flailCd = 0.35;
          const kd = Math.hypot(fl.x - e.x, fl.y - e.y) || 1;
          e.x += ((e.x - fl.x) / kd) * 18; e.y += ((e.y - fl.y) / kd) * 18;
          break;
        }
      }
    }
    // kontakt z graczem (małpa jest pasywna)
    const dd = Math.hypot(p.x - e.x, p.y - e.y);
    if (!e.passive && dd < p.r + e.r && e.dmgCd <= 0 && p.invuln <= 0) {
      p.hp -= e.dmg; e.dmgCd = 0.6;
      recordDmg(e.isBoss ? e.def.name : e.type, e.dmg);
      if (!e.isBoss) { e.x -= ((p.x - e.x) / (dd || 1)) * 22; e.y -= ((p.y - e.y) / (dd || 1)) * 22; }
    }
  }

  // pociski gracza
  for (const b of s.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of s.enemies) {
      if (e.alpha < 0.5) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r) { damageEnemy(e, b.dmg); b.life = 0; break; }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < view.w + 20 && b.y > -20 && b.y < view.h + 20);

  // kule ognia (przebijające)
  for (const f of s.fireballs) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
    for (const e of s.enemies) {
      if (e.alpha < 0.5) continue;
      if (!f.hit.has(e) && Math.hypot(f.x - e.x, f.y - e.y) < e.r + 18) { damageEnemy(e, f.dmg); f.hit.add(e); }
    }
  }
  s.fireballs = s.fireballs.filter((f) => f.life > 0);

  // pociski wrogów
  for (const b of s.enemyBullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (p.invuln <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < p.r + (b.size ? b.size * 0.3 : 8)) { p.hp -= b.dmg; recordDmg(b.src || "pocisk", b.dmg); b.life = 0; }
  }
  s.enemyBullets = s.enemyBullets.filter((b) => b.life > 0 && b.x > -30 && b.x < view.w + 30 && b.y > -30 && b.y < view.h + 30);

  // bomby
  for (const b of s.bombs) { b.fuse -= dt; if (b.fuse <= 0) createExplosion(b.x, b.y, 95 + a.bomb.lvl * 12, 4 + a.bomb.lvl * 2, false); }
  s.bombs = s.bombs.filter((b) => b.fuse > 0);

  // kałuże slime
  for (const pd of s.puddles) pd.life -= dt;
  s.puddles = s.puddles.filter((pd) => pd.life > 0);
  for (const pd of s.puddles) {
    if (p.puddleCd <= 0 && p.invuln <= 0 && Math.hypot(pd.x - p.x, pd.y - p.y) < pd.r + p.r) {
      p.hp -= 5; p.puddleCd = 0.5; recordDmg("śluz", 5);
    }
  }

  // efekty
  for (const ef of s.effects) ef.timer -= dt;
  s.effects = s.effects.filter((ef) => ef.timer > 0);

  // pickupy (leczenie/skrzynia) z czasem życia
  for (const it of s.pickups) it.life -= dt;
  // magnes: przyciąga jedzenie i skrzynie
  const magR = (s.abil.magnet.lvl > 0 ? 90 + s.abil.magnet.lvl * 60 : 0) + p.pickupRange;
  if (magR > 0) {
    for (const it of s.pickups) {
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < magR && d > 1) { it.x += ((p.x - it.x) / d) * 260 * dt; it.y += ((p.y - it.y) / d) * 260 * dt; }
    }
  }
  s.pickups = s.pickups.filter((it) => {
    if (it.life <= 0) return false;
    if (Math.hypot(it.x - p.x, it.y - p.y) < p.r + it.r) {
      if (it.kind === "food") p.hp = Math.min(p.maxHp, p.hp + 30);
      else if (it.kind === "chest") state.pendingLevelUps++;
      sfx("pickup");
      return false;
    }
    return true;
  });

  // usuń martwych + nagrody
  const alive = [];
  for (const e of s.enemies) {
    if (e.gone) continue; // małpa uciekła – bez nagrody
    if (e.hp > 0) alive.push(e);
    else onEnemyDeath(e);
  }
  s.enemies = alive;

  if (p.hp < s.prevHp) { s.hurtFlash = Math.min(1, s.hurtFlash + 0.6); sfx("damage"); }
  if (p.hp <= 0) { p.hp = 0; endGame(); return; }
  if (s.pendingLevelUps > 0) openLevelUp();
}

function onEnemyDeath(e) {
  const s = state;
  sfx("death");
  spawnParticles(e.x, e.y, e.isBoss ? 28 : e.isElite ? 12 : 7, e.isBoss ? "#fca5a5" : e.isElite ? "#fbbf24" : "#f87171", e.isBoss ? 260 : 150, 0.6);

  if (e.passive) {
    // małpa pokonana: następna ma więcej HP + zrzuca 1-5 bananów
    s.monkeyKills++;
    addXp(e.xp);
    const n = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 26 + Math.random() * 18;
      s.pickups.push({ kind: "food", x: e.x + Math.cos(a) * dist, y: e.y + Math.sin(a) * dist, r: 14, life: 7 });
    }
    return;
  }

  // kombo → mnożnik wyniku i monet
  s.combo++; s.comboTimer = 3;
  const mult = 1 + Math.floor(s.combo / 5) * 0.5;
  s.score += Math.round((e.isBoss ? 200 : e.isElite ? 30 : 10) * mult);
  s.coins += Math.round((e.isBoss ? 60 : e.isElite ? 5 : 1) * mult * difficultyMult.coin);

  s.kills++;
  addXp(e.xp);
  if (e.behavior === "exploder") createExplosion(e.x, e.y, 55, 10, true);

  if (e.isBoss) {
    s.levelPhase = "cleared";
    s.enemyBullets = [];
    s.pickups.push({ kind: "chest", x: e.x, y: e.y, r: 18, life: 22 });
    spawnPortal();
    return;
  }
  if (e.isElite) {
    s.pickups.push({ kind: Math.random() < 0.5 ? "food" : "chest", x: e.x, y: e.y, r: 16, life: 12 });
    return;
  }
  if (Math.random() < 0.03) s.pickups.push({ kind: "chest", x: e.x, y: e.y, r: 18, life: 12 });
}

// ===== Rysowanie =====
function drawSprite(img, x, y, size, angle, flipX) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  if (flipX) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
  else { ctx.fillStyle = "#64748b"; ctx.fillRect(-size / 2, -size / 2, size, size); }
  ctx.restore();
}

function render() {
  const s = state;
  const p = s.player;
  ctx.clearRect(0, 0, view.w, view.h);

  ctx.save();
  if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

  // kałuże slime
  for (const pd of s.puddles) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, pd.life / pd.max);
    drawSprite(S.slime_trail, pd.x, pd.y, pd.r * 2.6);
    ctx.restore();
  }

  // kwiaty-pułapki (pulsują; uzbrojone rosną)
  for (const f of s.flowers) {
    let scale = 1 + Math.sin(s.time * 5 + f.x) * 0.08;
    let alpha = 1;
    if (f.state === "arming") {
      const prog = 1 - f.t / 0.7;
      scale = 1 + prog * 0.7;
      alpha = 0.5 + 0.5 * Math.abs(Math.sin(s.time * 25));
    }
    ctx.save(); ctx.globalAlpha = alpha;
    drawSprite(f.friendly ? S.flower : S.bomb_trap, f.x, f.y, 40 * scale);
    ctx.restore();
  }

  // przeszkody
  for (const o of s.obstacles) {
    const size = o.type === "tree" ? 74 : 58;
    const yoff = o.type === "tree" ? -14 : 0;
    drawSprite(o.type === "tree" ? S.tree : S.rock, o.x, o.y + yoff, size);
  }

  // portal (animowany)
  if (s.portal) {
    const pr = s.portal;
    // poświata
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(s.time * 4);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r + 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // wirujący efekt
    drawSprite(S.portal_swirl, pr.x, pr.y, pr.r * 2, pr.spin);
    // rama
    drawSprite(S.portal_frame, pr.x, pr.y - 10, pr.r * 2.6);
  }

  // pickupy (unoszą się)
  for (const it of s.pickups) {
    const bob = Math.sin(s.time * 3 + it.x) * 4;
    const blink = it.life < 2 ? Math.abs(Math.sin(s.time * 12)) : 1;
    const img = it.kind === "food" ? S.food : S.chest;
    ctx.save(); ctx.globalAlpha = blink;
    drawSprite(img, it.x, it.y + bob, it.r * 2.4);
    ctx.restore();
  }

  // bomby
  for (const b of s.bombs) drawSprite(S.bomb, b.x, b.y, 34);

  // wrogowie
  for (const e of s.enemies) {
    const size = e.r * 2.2;
    const flip = e.faceFlip;
    const base = e.isBoss ? S[e.def.sprite] : e.type === "monkey" ? S.monkey_trader : S[ENEMY_TYPES[e.type].sprite];
    // aura elity
    if (e.isElite) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(s.time * 6 + e.seed);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    if (e.alpha < 1) ctx.globalAlpha = e.alpha;
    drawSprite(base, e.x, e.y, size, 0, flip);
    ctx.restore();
    const sr = e.isBoss ? SR[e.def.sprite] : SR[e.type];
    if (e.flash > 0 && sr) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.flash / FLASH) * 0.75;
      drawSprite(sr, e.x, e.y, size, 0, flip);
      ctx.restore();
    }
    if (!e.isBoss && e.maxHp > 3 && e.hp < e.maxHp) {
      const w = size * 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - w / 2, e.y - size / 2 - 8, w, 4);
      ctx.fillStyle = "#f87171";
      ctx.fillRect(e.x - w / 2, e.y - size / 2 - 8, w * (e.hp / e.maxHp), 4);
    }
  }

  // pociski wrogów
  for (const b of s.enemyBullets) drawSprite(b.sprite ? S[b.sprite] : S.enemy_projectile, b.x, b.y, b.size || 26, b.a);

  // tornada
  for (const tn of s.tornadoes) {
    ctx.save(); ctx.globalAlpha = 0.85;
    drawSprite(S.tornado, tn.x, tn.y, tn.r * 2, tn.spin);
    ctx.restore();
  }

  // auta
  for (const c of s.cars) drawSprite(S.car, c.x, c.y, 80, 0, c.vx > 0);

  // wybuchy
  for (const ef of s.effects) {
    ctx.save(); ctx.globalAlpha = Math.max(0, ef.timer / ef.max);
    drawSprite(S[ef.sprite] || S.explosion, ef.x, ef.y, ef.r * 2);
    ctx.restore();
  }

  // cząsteczki
  for (const pt of s.particles) {
    ctx.save(); ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    ctx.restore();
  }

  // gracz
  drawSprite(S.player, p.x, p.y, p.r * 2.2);
  if (p.invuln > 0) {
    ctx.save(); ctx.globalAlpha = 0.75;
    drawSprite(S.shield, p.x, p.y, p.r * 3.2 + Math.sin(s.time * 8) * 3);
    ctx.restore();
  }

  // pistolet w dłoni – dopiero po zdobyciu zdolności; celuje w kursor / wroga
  if (s.abil.gun.lvl > 0) {
    const ang = s.aimAng;
    const gx = p.x + Math.cos(ang) * (p.r + 4);
    const gy = p.y + Math.sin(ang) * (p.r + 4);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(ang);
    if (Math.abs(ang) > Math.PI / 2) ctx.scale(1, -1); // nie do góry nogami
    ctx.imageSmoothingEnabled = false;
    if (S.gun) ctx.drawImage(S.gun, -16, -16, 32, 32);
    ctx.restore();
  }

  // kolczaste kule na łańcuchu
  if (s.abil.flail.lvl > 0) {
    const cnt = Math.min(3, s.abil.flail.lvl);
    for (let i = 0; i < cnt; i++) {
      const a = s.flailAngle + (i * Math.PI * 2) / cnt;
      const bx = p.x + Math.cos(a) * 92, by = p.y + Math.sin(a) * 92;
      ctx.save();
      ctx.strokeStyle = "rgba(190,190,200,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
      drawSprite(S.spiked_ball, bx, by, 40, s.flailAngle * 2);
    }
  }

  // miecze
  for (let i = 0; i < s.sword.count; i++) {
    const a = s.angle + (i * Math.PI * 2) / s.sword.count;
    drawSprite(S[s.sword.sprite], p.x + Math.cos(a) * s.sword.orbit, p.y + Math.sin(a) * s.sword.orbit, 46, a + Math.PI / 2 + Math.PI / 4);
  }

  // pociski gracza
  for (const b of s.bullets) drawSprite(S.bullet, b.x, b.y, 18, Math.atan2(b.vy, b.vx));

  // kule ognia
  for (const f of s.fireballs) drawSprite(S.firball, f.x, f.y, 44, f.a);

  ctx.restore(); // shake

  // noc – ciemność z latarką wokół gracza
  if (s.event === "night") {
    const g = ctx.createRadialGradient(p.x, p.y, 70, p.x, p.y, 280);
    g.addColorStop(0, "rgba(0,0,12,0)");
    g.addColorStop(1, "rgba(0,0,14,0.92)");
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h); ctx.restore();
  }

  // pasek HP bossa (u góry)
  const boss = s.enemies.find((e) => e.isBoss);
  if (boss) {
    const bw = Math.min(560, view.w - 80), bx = (view.w - bw) / 2, by = 56;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(bx - 2, by - 2, bw + 4, 20);
    ctx.fillStyle = "#3f0f0f"; ctx.fillRect(bx, by, bw, 16);
    ctx.fillStyle = boss.phase === 2 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 16);
    ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(s.bossName + (boss.phase === 2 ? " — FURIA!" : ""), view.w / 2, by + 8);
    ctx.restore();
  }

  // zamrożenie – niebieska mgła
  if (s.freeze > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#7dd3fc";
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }

  // efekt obrażeń – czerwona winieta
  if (s.hurtFlash > 0) {
    const g = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.28, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.72);
    g.addColorStop(0, "rgba(220,0,0,0)");
    g.addColorStop(1, "rgba(200,0,0," + (0.6 * s.hurtFlash).toFixed(3) + ")");
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }

  // baner
  if (s.banner) {
    const b = s.banner;
    const al = b.t > b.max - 0.3 ? (b.max - b.t) / 0.3 : Math.min(1, b.t / 0.6);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.fillStyle = "#fde047";
    ctx.font = "bold " + Math.min(56, view.w / 10) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(b.text, view.w / 2, view.h * 0.28);
    ctx.restore();
  }

  // przejście między poziomami – czerwony wir + błysk
  if (s.transition) {
    const tr = s.transition;
    const prog = 1 - tr.t / tr.max; // 0..1
    const fade = 1 - Math.abs(prog - 0.5) * 2; // 0..1..0
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
    const sz = Math.max(view.w, view.h) * (0.3 + prog * 1.4);
    ctx.save();
    ctx.globalAlpha = fade;
    drawSprite(S.portal_swirl, view.w / 2, view.h / 2, sz, s.time * 8);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#fff";
    ctx.font = "bold " + Math.min(52, view.w / 11) + "px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 12;
    ctx.fillText("POZIOM " + s.glevel, view.w / 2, view.h / 2);
    ctx.restore();
  }
}

// ===== HUD =====
function updateHud() {
  const s = state, p = s.player;
  timeEl.textContent = s.time.toFixed(1);
  killsEl.textContent = s.kills;
  glevelEl.textContent = s.glevel;
  waveEl.textContent = s.wave;
  waveMaxEl.textContent = s.wavesInLevel;
  levelEl.textContent = p.level;
  const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
  healthFill.style.width = hpPct + "%";
  hpTextEl.textContent = Math.max(0, Math.ceil(p.hp)) + "/" + p.maxHp;
  healthFill.style.background =
    hpPct > 50 ? "linear-gradient(90deg,#4ade80,#22c55e)"
      : hpPct > 25 ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
        : "linear-gradient(90deg,#f87171,#ef4444)";
  xpFill.style.width = (p.xp / p.xpNext) * 100 + "%";
  coinsEl.textContent = s.coins;
  if (s.combo >= 2) {
    const mult = 1 + Math.floor(s.combo / 5) * 0.5;
    comboEl.textContent = "KOMBO x" + s.combo + (mult > 1 ? "  (×" + mult + " pkt)" : "");
    comboEl.classList.remove("hidden");
  } else comboEl.classList.add("hidden");
}

// ===== Pętla =====
function loop(now) {
  if (!running) return;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;
  if (!paused) update(dt);
  if (running) { render(); updateHud(); requestAnimationFrame(loop); }
}

// ===== Start / koniec =====
function startGame() {
  initAudio();
  resize();
  state = newState();
  genObstacles();
  startWave();
  running = true; paused = false; pauseMenu = false;
  lastTime = performance.now();
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  levelupScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  shopScreen.classList.add("hidden");
  shopOpen = false;
  pauseBtn.classList.remove("hidden");
  musicStart();
  requestAnimationFrame(loop);
}
function drawStatsChart(data) {
  const c = statsChart, x = c.getContext("2d");
  x.clearRect(0, 0, c.width, c.height);
  if (!data.length) return;
  const max = Math.max(1, ...data);
  x.strokeStyle = "#38bdf8"; x.lineWidth = 2; x.beginPath();
  data.forEach((v, i) => {
    const px = (i / (data.length - 1 || 1)) * c.width;
    const py = c.height - (v / max) * (c.height - 6) - 3;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  });
  x.stroke();
  x.lineTo(c.width, c.height); x.lineTo(0, c.height); x.closePath();
  x.fillStyle = "rgba(56,189,248,0.15)"; x.fill();
}
function endGame() {
  running = false; paused = false; pauseMenu = false; shopOpen = false; state.over = true;
  pauseBtn.classList.add("hidden");
  joystickEl.classList.add("hidden"); joy.active = false;
  musicStop();
  const s = state;
  let killer = "—", kmax = 0;
  for (const k in s.stats.dmgBySource) if (s.stats.dmgBySource[k] > kmax) { kmax = s.stats.dmgBySource[k]; killer = k; }
  const dps = s.time > 0 ? Math.round(s.stats.dmgDealt / s.time) : 0;
  statsBoxEl.innerHTML =
    `<div class="s-row"><span>Czas</span><b>${s.time.toFixed(1)}s</b></div>` +
    `<div class="s-row"><span>Poziom</span><b>${s.glevel}</b></div>` +
    `<div class="s-row"><span>Zabójstwa</span><b>${s.kills}</b></div>` +
    `<div class="s-row"><span>Wynik</span><b>${s.score}</b></div>` +
    `<div class="s-row"><span>Monety</span><b>${s.coins}</b></div>` +
    `<div class="s-row"><span>Śr. DPS</span><b>${dps}</b></div>` +
    `<div class="s-row"><span>Lvl gracza</span><b>${s.player.level}</b></div>` +
    `<div class="s-row"><span>Najgroźniejszy</span><b>${killer}</b></div>`;
  drawStatsChart(s.stats.timeline);
  const best = Number(localStorage.getItem("arena-best") || 0);
  if (s.score > best) { localStorage.setItem("arena-best", s.score); bestEl.textContent = "🏆 Nowy rekord wyniku: " + s.score + "!"; }
  else bestEl.textContent = "Najlepszy wynik: " + best;
  gameoverScreen.classList.remove("hidden");
}
document.querySelectorAll(".diff-btn").forEach((b) => b.addEventListener("click", () => {
  const d = b.dataset.diff;
  if (d === "easy") difficultyMult = { hp: 0.7, dmg: 0.7, speed: 0.9, coin: 1.3, name: "Łatwy" };
  else if (d === "hard") difficultyMult = { hp: 1.6, dmg: 1.5, speed: 1.15, coin: 0.8, name: "Hardcore" };
  else difficultyMult = { hp: 1, dmg: 1, speed: 1, coin: 1, name: "Normalny" };
  startGame();
}));
restartBtn.addEventListener("click", startGame);
shopNextBtn.addEventListener("click", () => {
  shopScreen.classList.add("hidden");
  shopOpen = false; paused = false;
  nextLevel();
  lastTime = performance.now();
});

// ===== Pauza / dźwięk =====
function setPause(on) {
  if (!running) return;
  if (on) {
    if (paused) return; // np. trwa wybór ulepszenia
    paused = true; pauseMenu = true;
    pauseScreen.classList.remove("hidden");
    joystickEl.classList.add("hidden"); joy.active = false;
  } else {
    if (!pauseMenu) return;
    pauseMenu = false; paused = false;
    pauseScreen.classList.add("hidden");
    lastTime = performance.now();
  }
}
function updateSoundLabel() { soundBtn.textContent = soundOn ? "🔊 Dźwięk: wł." : "🔇 Dźwięk: wył."; }
pauseBtn.addEventListener("click", () => { if (pauseMenu) setPause(false); else if (!paused) setPause(true); });
resumeBtn.addEventListener("click", () => setPause(false));
quitBtn.addEventListener("click", () => {
  running = false; paused = false; pauseMenu = false;
  musicStop();
  pauseScreen.classList.add("hidden");
  pauseBtn.classList.add("hidden");
  startScreen.classList.remove("hidden");
});
soundBtn.addEventListener("click", () => { soundOn = !soundOn; if (soundOn) initAudio(); updateSoundLabel(); });
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ((k === "escape" || k === "p") && running) {
    if (pauseMenu) setPause(false);
    else if (!paused) setPause(true);
  }
});

// hook do testów
window.__debug = { S, SR, getState: () => state, nextLevel: () => nextLevel() };

// ===== Init =====
(async function init() {
  resize();
  const names = [
    "player", "sword", "gun", "bomb", "explosion", "shield", "health",
    "chest", "food", "flower", "freeze", "bullet", "firball", "xp", "tornado",
    "rock", "tree", "car", "bomb_trap", "bomb_trap_effect",
    "spiked_ball", "monkey_trader", "slime_trail", "magnet", "shop_keeper",
    "portal_frame", "portal_swirl", "enemy_projectile",
    "small_enemy", "normal_enemy", "big_enemy", "slime_enemy", "lizard_enemy",
    "spider_enemy", "ghost_enemy", "golem_enemy", "shooting_enemy", "dino_enemy",
    "demon_enemy", "fish_enemy", "creature_enemy", "devourer_enemy", "robot_enemy", "bug_enemy",
    "boss1", "boss2", "boss3", "boss4", "boss5", "boss6", "boss7",
    "effect1", "effect2", "effect3", "effect4", "effect5", "effect6", "effect7", "effect8", "effect9",
  ];
  const imgs = await Promise.all(names.map((n) => loadImage(`assets/${n}.png`)));
  names.forEach((n, i) => (S[n] = imgs[i]));

  // czerwone sylwetki wszystkich typów wrogów
  for (const key in ENEMY_TYPES) SR[key] = makeTint(S[ENEMY_TYPES[key].sprite], "#ff3b3b");
  SR.monkey = makeTint(S.monkey_trader, "#ff3b3b");
  for (let i = 1; i <= 7; i++) SR["boss" + i] = makeTint(S["boss" + i], "#ff3b3b");
})();
