// ===== Arena Survivor =====
// Gra 2D: gracz z obracającym się mieczem, fale zombie. PC (WASD) + telefon (joystick).

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --- HUD ---
const timeEl = document.getElementById("time");
const killsEl = document.getElementById("kills");
const waveEl = document.getElementById("wave");
const healthFill = document.getElementById("healthfill");

// --- Ekrany ---
const startScreen = document.getElementById("start");
const gameoverScreen = document.getElementById("gameover");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const finalTimeEl = document.getElementById("finalTime");
const finalKillsEl = document.getElementById("finalKills");
const bestEl = document.getElementById("best");

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

let sprites = {};

// ===== Widok / skalowanie (obsługa DPR i resize) =====
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

// ===== Stan gry =====
let state = null;
let running = false;
let lastTime = 0;

function newState() {
  return {
    player: {
      x: view.w / 2,
      y: view.h / 2,
      r: 22,
      speed: 230,
      hp: 100,
      maxHp: 100,
    },
    sword: { angle: 0, orbit: 52, rotSpeed: 5, hitR: 28 },
    enemies: [],
    time: 0,
    kills: 0,
    wave: 1,
    waveTimer: 0,
    spawnTimer: 0,
    over: false,
  };
}

// ===== Wejście: klawiatura =====
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ===== Wejście: dotyk (dynamiczny joystick) =====
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const JOY_MAX = 55;

function isTouch(e) {
  return e.pointerType === "touch";
}

canvas.addEventListener("pointerdown", (e) => {
  if (!running || !isTouch(e)) return;
  joy.active = true;
  joy.id = e.pointerId;
  joy.ox = e.clientX;
  joy.oy = e.clientY;
  joy.dx = 0;
  joy.dy = 0;
  joystickEl.style.left = e.clientX - 65 + "px";
  joystickEl.style.top = e.clientY - 65 + "px";
  joystickEl.style.bottom = "auto";
  joystickEl.classList.remove("hidden");
  stickEl.style.transform = "translate(0,0)";
});

canvas.addEventListener("pointermove", (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox;
  let dy = e.clientY - joy.oy;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_MAX) {
    dx = (dx / dist) * JOY_MAX;
    dy = (dy / dist) * JOY_MAX;
  }
  joy.dx = dx / JOY_MAX;
  joy.dy = dy / JOY_MAX;
  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
});

function endJoy(e) {
  if (e.pointerId !== joy.id) return;
  joy.active = false;
  joy.dx = 0;
  joy.dy = 0;
  joystickEl.classList.add("hidden");
}
canvas.addEventListener("pointerup", endJoy);
canvas.addEventListener("pointercancel", endJoy);

// ===== Pomocnicze =====
function getMoveVector() {
  let x = 0,
    y = 0;
  if (keys["w"] || keys["arrowup"]) y -= 1;
  if (keys["s"] || keys["arrowdown"]) y += 1;
  if (keys["a"] || keys["arrowleft"]) x -= 1;
  if (keys["d"] || keys["arrowright"]) x += 1;
  // joystick nadpisuje/łączy się
  if (joy.active) {
    x += joy.dx;
    y += joy.dy;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

function spawnEnemy() {
  const s = state;
  const margin = 40;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) {
    x = Math.random() * view.w;
    y = -margin;
  } else if (side === 1) {
    x = view.w + margin;
    y = Math.random() * view.h;
  } else if (side === 2) {
    x = Math.random() * view.w;
    y = view.h + margin;
  } else {
    x = -margin;
    y = Math.random() * view.h;
  }
  const hp = 1 + Math.floor((s.wave - 1) / 3);
  s.enemies.push({
    x,
    y,
    r: 20,
    speed: 55 + s.wave * 8,
    hp,
    hitCd: 0, // odporność po trafieniu mieczem
    dmgCd: 0, // cooldown zadawania obrażeń graczowi
  });
}

// ===== Aktualizacja =====
function update(dt) {
  const s = state;
  const p = s.player;

  s.time += dt;

  // fale
  s.waveTimer += dt;
  if (s.waveTimer >= 12) {
    s.waveTimer = 0;
    s.wave++;
  }

  // spawn wrogów
  s.spawnTimer -= dt;
  const spawnInterval = Math.max(0.35, 1.4 - s.wave * 0.12);
  if (s.spawnTimer <= 0) {
    spawnEnemy();
    s.spawnTimer = spawnInterval;
  }

  // ruch gracza
  const mv = getMoveVector();
  p.x += mv.x * p.speed * dt;
  p.y += mv.y * p.speed * dt;
  p.x = Math.max(p.r, Math.min(view.w - p.r, p.x));
  p.y = Math.max(p.r, Math.min(view.h - p.r, p.y));

  // miecz obraca się wokół gracza
  s.sword.angle += s.sword.rotSpeed * dt;
  const sx = p.x + Math.cos(s.sword.angle) * s.sword.orbit;
  const sy = p.y + Math.sin(s.sword.angle) * s.sword.orbit;

  // wrogowie
  for (const e of s.enemies) {
    e.hitCd -= dt;
    e.dmgCd -= dt;

    // ruch w stronę gracza
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;

    // trafienie mieczem
    const sd = Math.hypot(sx - e.x, sy - e.y);
    if (sd < s.sword.hitR + e.r && e.hitCd <= 0) {
      e.hp -= 1;
      e.hitCd = 0.3;
      // odrzut od miecza
      const kx = (e.x - sx) / (sd || 1);
      const ky = (e.y - sy) / (sd || 1);
      e.x += kx * 14;
      e.y += ky * 14;
    }

    // kontakt z graczem -> obrażenia
    if (d < p.r + e.r && e.dmgCd <= 0) {
      p.hp -= 12;
      e.dmgCd = 0.6;
      // odrzut wroga
      e.x -= (dx / d) * 24;
      e.y -= (dy / d) * 24;
    }
  }

  // usuń martwych, licz zabójstwa
  const before = s.enemies.length;
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.kills += before - s.enemies.length;

  // koniec gry
  if (p.hp <= 0) {
    p.hp = 0;
    endGame();
  }
}

// ===== Rysowanie =====
function drawSprite(img, x, y, size, angle) {
  if (!img) {
    // fallback gdyby sprite się nie wczytał
    ctx.fillStyle = "#64748b";
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function render() {
  const s = state;
  const p = s.player;
  ctx.clearRect(0, 0, view.w, view.h);

  // wrogowie
  for (const e of s.enemies) {
    drawSprite(sprites.enemy, e.x, e.y, e.r * 2.2);
  }

  // gracz
  drawSprite(sprites.player, p.x, p.y, p.r * 2.2);

  // miecz (obraca się wokół gracza, ostrzem na zewnątrz)
  const sx = p.x + Math.cos(s.sword.angle) * s.sword.orbit;
  const sy = p.y + Math.sin(s.sword.angle) * s.sword.orbit;
  drawSprite(sprites.sword, sx, sy, 48, s.sword.angle + Math.PI / 2 + Math.PI / 4);
}

// ===== HUD =====
function updateHud() {
  const s = state;
  timeEl.textContent = s.time.toFixed(1);
  killsEl.textContent = s.kills;
  waveEl.textContent = s.wave;
  const pct = Math.max(0, s.player.hp / s.player.maxHp) * 100;
  healthFill.style.width = pct + "%";
  healthFill.style.background =
    pct > 50
      ? "linear-gradient(90deg,#4ade80,#22c55e)"
      : pct > 25
      ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
      : "linear-gradient(90deg,#f87171,#ef4444)";
}

// ===== Pętla =====
function loop(now) {
  if (!running) return;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05; // ochrona przy zacięciach / kartach w tle

  update(dt);
  render();
  updateHud();

  requestAnimationFrame(loop);
}

// ===== Start / koniec =====
function startGame() {
  resize();
  state = newState();
  running = true;
  lastTime = performance.now();
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  state.over = true;
  joystickEl.classList.add("hidden");
  joy.active = false;

  finalTimeEl.textContent = state.time.toFixed(1);
  finalKillsEl.textContent = state.kills;

  // najlepszy wynik w localStorage
  const best = Number(localStorage.getItem("arena-best") || 0);
  if (state.time > best) {
    localStorage.setItem("arena-best", state.time.toFixed(1));
    bestEl.textContent = "🏆 Nowy rekord!";
  } else {
    bestEl.textContent = "Najlepszy wynik: " + best.toFixed(1) + "s";
  }

  gameoverScreen.classList.remove("hidden");
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

// ===== Init =====
(async function init() {
  resize();
  const [player, enemy, sword] = await Promise.all([
    loadImage("assets/player.png"),
    loadImage("assets/enemy.png"),
    loadImage("assets/sword.png"),
  ]);
  sprites = { player, enemy, sword };
})();
