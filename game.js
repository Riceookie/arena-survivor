// ===== Arena Survivor =====
// Gra 2D: gracz z bronią, fale zombie, system poziomów i ulepszeń.
// PC (WASD) + telefon (dynamiczny joystick).

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// --- HUD ---
const timeEl = document.getElementById("time");
const killsEl = document.getElementById("kills");
const waveEl = document.getElementById("wave");
const levelEl = document.getElementById("level");
const healthFill = document.getElementById("healthfill");
const xpFill = document.getElementById("xpfill");

// --- Ekrany ---
const startScreen = document.getElementById("start");
const gameoverScreen = document.getElementById("gameover");
const levelupScreen = document.getElementById("levelup");
const cardsEl = document.getElementById("cards");
const lvlNumEl = document.getElementById("lvlNum");
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

// czerwona sylwetka sprite'a (do miganie przy trafieniu)
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

// ===== Typy wrogów =====
// duży = więcej HP, wolniejszy; mały = mniej HP, szybszy
const ENEMY_TYPES = {
  small: { sprite: "small_enemy", r: 15, hp: 1, speed: 100, xp: 1, dmg: 8 },
  normal: { sprite: "normal_enemy", r: 23, hp: 3, speed: 65, xp: 2, dmg: 12 },
  big: { sprite: "big_enemy", r: 34, hp: 7, speed: 42, xp: 4, dmg: 20 },
  boss: { sprite: "boss", r: 55, hp: 60, speed: 34, xp: 30, dmg: 35 },
};

const FLASH = 0.18; // czas migania na czerwono po trafieniu

// ===== Stan gry =====
let state = null;
let running = false;
let paused = false;
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
      xp: 0,
      xpNext: 5,
      level: 1,
      invuln: 0,
    },
    // broń podstawowa (miecz), można ją ulepszać
    sword: { count: 1, damage: 1, orbit: 54, rotSpeed: 5, hitR: 26, sprite: "sword" },
    angle: 0,
    // zdolności (0 = zablokowana)
    abil: {
      gun: { lvl: 0, cd: 0 },
      bomb: { lvl: 0, cd: 0 },
      shield: { lvl: 0, cd: 0 },
      fireball: { lvl: 0, cd: 0 },
    },
    enemies: [],
    bullets: [],
    fireballs: [],
    bombs: [],
    effects: [],
    pickups: [],
    time: 0,
    kills: 0,
    wave: 1,
    waveTimer: 0,
    spawnTimer: 0,
    lastBossWave: 0,
    pendingLevelUps: 0,
    over: false,
  };
}

// ===== Wejście: klawiatura =====
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// ===== Wejście: dotyk (dynamiczny joystick) =====
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const JOY_MAX = 55;

canvas.addEventListener("pointerdown", (e) => {
  if (!running || paused || e.pointerType !== "touch") return;
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
function moveVector() {
  let x = 0,
    y = 0;
  if (keys["w"] || keys["arrowup"]) y -= 1;
  if (keys["s"] || keys["arrowdown"]) y += 1;
  if (keys["a"] || keys["arrowleft"]) x -= 1;
  if (keys["d"] || keys["arrowright"]) x += 1;
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

function nearestEnemy(x, y) {
  let best = null,
    bd = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
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
    const roll = Math.random();
    if (s.wave >= 4 && roll < 0.2) type = "big";
    else if (roll < 0.45) type = "small";
    else type = "normal";
  }
  const t = ENEMY_TYPES[type];
  const hp = Math.round(t.hp * (1 + (s.wave - 1) * 0.18));
  s.enemies.push({
    type,
    x,
    y,
    r: t.r,
    speed: t.speed,
    hp,
    maxHp: hp,
    xp: t.xp,
    dmg: t.dmg,
    hitCd: 0,
    dmgCd: 0,
    flash: 0,
    facing: 1,
  });
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  e.flash = FLASH;
}

function createExplosion(x, y, radius, dmg) {
  state.effects.push({ x, y, r: radius, timer: 0.45, max: 0.45 });
  for (const e of state.enemies) {
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r) damageEnemy(e, dmg);
  }
}

// ===== System poziomów =====
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

// pula ulepszeń
function upgradePool() {
  const s = state;
  const sw = s.sword;
  const a = s.abil;
  const list = [
    {
      id: "dmg",
      icon: "sword",
      title: "Ostry miecz",
      desc: "+1 obrażeń miecza",
      lvl: sw.damage,
      apply: () => (sw.damage += 1),
    },
    {
      id: "count",
      icon: "sword",
      title: "Dodatkowy miecz",
      desc: "+1 wirujący miecz",
      lvl: sw.count,
      show: sw.count < 8,
      apply: () => (sw.count += 1),
    },
    {
      id: "spin",
      icon: "sword",
      title: "Szybszy miecz",
      desc: "Miecz kręci się szybciej",
      lvl: Math.round(sw.rotSpeed),
      apply: () => (sw.rotSpeed += 1.4),
    },
    {
      id: "scythe",
      icon: "scythe",
      title: "Kosa — większy zasięg",
      desc: "Dłuższy zasięg i obrażenia broni",
      lvl: 0,
      show: sw.sprite !== "scythe",
      apply: () => {
        sw.sprite = "scythe";
        sw.orbit += 22;
        sw.hitR += 12;
        sw.damage += 1;
      },
    },
    {
      id: "hp",
      icon: "heart",
      title: "Więcej życia",
      desc: "+25 max HP i leczy",
      lvl: Math.round(s.player.maxHp / 25),
      apply: () => {
        s.player.maxHp += 25;
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40);
      },
    },
    {
      id: "speed",
      icon: "player",
      title: "Szybsze nogi",
      desc: "+ prędkość ruchu",
      lvl: Math.round((s.player.speed - 230) / 30) + 1,
      apply: () => (s.player.speed += 30),
    },
    {
      id: "gun",
      icon: "gun",
      title: a.gun.lvl ? "Lepszy pistolet" : "Pistolet",
      desc: a.gun.lvl ? "Szybszy ogień i obrażenia" : "Auto-strzela do wrogów",
      lvl: a.gun.lvl,
      apply: () => (a.gun.lvl += 1),
    },
    {
      id: "bomb",
      icon: "bomb",
      title: a.bomb.lvl ? "Więcej bomb" : "Bomby",
      desc: a.bomb.lvl ? "Częstsze, silniejsze wybuchy" : "Rzuca wybuchające bomby",
      lvl: a.bomb.lvl,
      apply: () => (a.bomb.lvl += 1),
    },
    {
      id: "shield",
      icon: "shield",
      title: a.shield.lvl ? "Lepsza tarcza" : "Tarcza",
      desc: a.shield.lvl ? "Częstsza / dłuższa ochrona" : "Cyklicznie chroni przed wrogami",
      lvl: a.shield.lvl,
      apply: () => (a.shield.lvl += 1),
    },
    {
      id: "fireball",
      icon: "fireball",
      title: a.fireball.lvl ? "Większa kula ognia" : "Kula ognia",
      desc: a.fireball.lvl ? "Częstsze, silniejsze pociski" : "Wystrzeliwuje przebijające kule ognia",
      lvl: a.fireball.lvl,
      apply: () => (a.fireball.lvl += 1),
    },
  ];
  return list.filter((u) => u.show !== false);
}

function openLevelUp() {
  paused = true;
  lvlNumEl.textContent = state.player.level;

  // wylosuj 3 różne ulepszenia
  const pool = upgradePool();
  const chosen = [];
  while (chosen.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(i, 1)[0]);
  }

  cardsEl.innerHTML = "";
  for (const u of chosen) {
    const card = document.createElement("button");
    card.className = "upgrade-card";
    card.innerHTML = `
      <img src="assets/${u.icon === "fireball" ? "fireball.gif" : u.icon + ".png"}" alt="" />
      <div>
        <div class="u-title">${u.title}</div>
        <div class="u-desc">${u.desc}</div>
      </div>
      ${u.lvl ? `<div class="u-lvl">Lvl ${u.lvl}</div>` : ""}
    `;
    card.addEventListener("click", () => {
      u.apply();
      state.pendingLevelUps--;
      levelupScreen.classList.add("hidden");
      if (state.pendingLevelUps > 0) openLevelUp();
      else {
        paused = false;
        lastTime = performance.now();
      }
    });
    cardsEl.appendChild(card);
  }
  levelupScreen.classList.remove("hidden");
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
  // boss co 5 fal
  if (s.wave % 5 === 0 && s.wave !== s.lastBossWave) {
    s.lastBossWave = s.wave;
    spawnEnemy("boss");
  }

  // spawn wrogów
  s.spawnTimer -= dt;
  const interval = Math.max(0.3, 1.4 - s.wave * 0.1);
  if (s.spawnTimer <= 0) {
    spawnEnemy();
    s.spawnTimer = interval;
  }

  // ruch gracza
  const mv = moveVector();
  p.x += mv.x * p.speed * dt;
  p.y += mv.y * p.speed * dt;
  p.x = Math.max(p.r, Math.min(view.w - p.r, p.x));
  p.y = Math.max(p.r, Math.min(view.h - p.r, p.y));
  if (p.invuln > 0) p.invuln -= dt;

  // miecze (obracają się wokół gracza)
  s.angle += s.sword.rotSpeed * dt;
  const swords = [];
  for (let i = 0; i < s.sword.count; i++) {
    const a = s.angle + (i * Math.PI * 2) / s.sword.count;
    swords.push({
      x: p.x + Math.cos(a) * s.sword.orbit,
      y: p.y + Math.sin(a) * s.sword.orbit,
      a,
    });
  }

  // --- zdolności ---
  const a = s.abil;
  // pistolet
  if (a.gun.lvl > 0) {
    a.gun.cd -= dt;
    if (a.gun.cd <= 0) {
      const target = nearestEnemy(p.x, p.y);
      if (target) {
        const ang = Math.atan2(target.y - p.y, target.x - p.x);
        s.bullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * 520,
          vy: Math.sin(ang) * 520,
          dmg: 1 + a.gun.lvl,
          life: 1.5,
        });
        a.gun.cd = Math.max(0.22, 0.9 - a.gun.lvl * 0.1);
      }
    }
  }
  // bomby
  if (a.bomb.lvl > 0) {
    a.bomb.cd -= dt;
    if (a.bomb.cd <= 0) {
      s.bombs.push({ x: p.x, y: p.y, fuse: 1.0 });
      a.bomb.cd = Math.max(2, 5 - a.bomb.lvl * 0.4);
    }
  }
  // tarcza
  if (a.shield.lvl > 0) {
    a.shield.cd -= dt;
    if (a.shield.cd <= 0) {
      p.invuln = 1.5 + a.shield.lvl * 0.3;
      a.shield.cd = Math.max(4, 9 - a.shield.lvl) + p.invuln;
    }
  }
  // kula ognia
  if (a.fireball.lvl > 0) {
    a.fireball.cd -= dt;
    if (a.fireball.cd <= 0) {
      const target = nearestEnemy(p.x, p.y);
      if (target) {
        const ang = Math.atan2(target.y - p.y, target.x - p.x);
        s.fireballs.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * 340,
          vy: Math.sin(ang) * 340,
          a: ang,
          dmg: 3 + a.fireball.lvl * 2,
          life: 2.2,
          hit: new Set(),
        });
        a.fireball.cd = Math.max(1.5, 4 - a.fireball.lvl * 0.3);
      }
    }
  }

  // --- wrogowie ---
  for (const e of s.enemies) {
    e.hitCd -= dt;
    e.dmgCd -= dt;
    if (e.flash > 0) e.flash -= dt;

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;
    e.facing = dx < 0 ? -1 : 1; // obraca się w stronę ruchu

    // trafienia mieczem
    for (const sw of swords) {
      if (e.hitCd <= 0 && Math.hypot(sw.x - e.x, sw.y - e.y) < s.sword.hitR + e.r) {
        damageEnemy(e, s.sword.damage);
        e.hitCd = 0.3;
        const kd = Math.hypot(sw.x - e.x, sw.y - e.y) || 1;
        e.x += ((e.x - sw.x) / kd) * 12;
        e.y += ((e.y - sw.y) / kd) * 12;
        break;
      }
    }

    // kontakt z graczem
    if (d < p.r + e.r && e.dmgCd <= 0 && p.invuln <= 0) {
      p.hp -= e.dmg;
      e.dmgCd = 0.6;
      e.x -= (dx / d) * 22;
      e.y -= (dy / d) * 22;
    }
  }

  // pociski (pistolet)
  for (const b of s.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of s.enemies) {
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r) {
        damageEnemy(e, b.dmg);
        b.life = 0;
        break;
      }
    }
  }
  s.bullets = s.bullets.filter(
    (b) => b.life > 0 && b.x > -20 && b.x < view.w + 20 && b.y > -20 && b.y < view.h + 20
  );

  // kule ognia (przebijające)
  for (const f of s.fireballs) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    for (const e of s.enemies) {
      if (!f.hit.has(e) && Math.hypot(f.x - e.x, f.y - e.y) < e.r + 18) {
        damageEnemy(e, f.dmg);
        f.hit.add(e);
      }
    }
  }
  s.fireballs = s.fireballs.filter((f) => f.life > 0);

  // bomby -> wybuchy
  for (const b of s.bombs) {
    b.fuse -= dt;
    if (b.fuse <= 0) createExplosion(b.x, b.y, 95 + a.bomb.lvl * 12, 4 + a.bomb.lvl * 2);
  }
  s.bombs = s.bombs.filter((b) => b.fuse > 0);

  // efekty (wybuchy) tylko wizualnie
  for (const ef of s.effects) ef.timer -= dt;
  s.effects = s.effects.filter((ef) => ef.timer > 0);

  // pickupy
  s.pickups = s.pickups.filter((it) => {
    if (Math.hypot(it.x - p.x, it.y - p.y) < p.r + it.r) {
      if (it.kind === "heart") p.hp = Math.min(p.maxHp, p.hp + 25);
      else if (it.kind === "chest") state.pendingLevelUps++;
      return false;
    }
    return true;
  });

  // usuń martwych wrogów + nagrody
  const alive = [];
  for (const e of s.enemies) {
    if (e.hp > 0) alive.push(e);
    else onEnemyDeath(e);
  }
  s.enemies = alive;

  // koniec gry
  if (p.hp <= 0) {
    p.hp = 0;
    endGame();
    return;
  }

  // level up?
  if (s.pendingLevelUps > 0) openLevelUp();
}

function onEnemyDeath(e) {
  const s = state;
  s.kills++;
  addXp(e.xp);
  // dropy
  const r = Math.random();
  if (e.type === "boss") s.pickups.push({ kind: "chest", x: e.x, y: e.y, r: 18 });
  else if (r < 0.08) s.pickups.push({ kind: "heart", x: e.x, y: e.y, r: 14 });
  else if (r < 0.1) s.pickups.push({ kind: "chest", x: e.x, y: e.y, r: 18 });
}

// ===== Rysowanie =====
function drawSprite(img, x, y, size, angle, flipX) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  if (flipX) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
  else {
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

function render() {
  const s = state;
  const p = s.player;
  ctx.clearRect(0, 0, view.w, view.h);

  // pickupy
  for (const it of s.pickups) {
    const img = it.kind === "heart" ? S.heart : S.chest;
    drawSprite(img, it.x, it.y, it.r * 2.4);
  }

  // bomby
  for (const b of s.bombs) drawSprite(S.bomb, b.x, b.y, 34);

  // wrogowie (+ miganie na czerwono + obrót)
  for (const e of s.enemies) {
    const size = e.r * 2.2;
    const flip = e.facing < 0;
    drawSprite(S[ENEMY_TYPES[e.type].sprite], e.x, e.y, size, 0, flip);
    if (e.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.flash / FLASH) * 0.75;
      drawSprite(SR[e.type], e.x, e.y, size, 0, flip);
      ctx.restore();
    }
    // pasek HP dla większych wrogów
    if (e.maxHp > 3 && e.hp < e.maxHp) {
      const w = size * 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - w / 2, e.y - size / 2 - 8, w, 4);
      ctx.fillStyle = "#f87171";
      ctx.fillRect(e.x - w / 2, e.y - size / 2 - 8, w * (e.hp / e.maxHp), 4);
    }
  }

  // wybuchy
  for (const ef of s.effects) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ef.timer / ef.max);
    drawSprite(S.explosion, ef.x, ef.y, ef.r * 2);
    ctx.restore();
  }

  // gracz
  drawSprite(S.player, p.x, p.y, p.r * 2.2);

  // tarcza (aura ochrony)
  if (p.invuln > 0) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    drawSprite(S.shield, p.x, p.y, p.r * 3.2);
    ctx.restore();
  }

  // miecze
  for (let i = 0; i < s.sword.count; i++) {
    const a = s.angle + (i * Math.PI * 2) / s.sword.count;
    const sx = p.x + Math.cos(a) * s.sword.orbit;
    const sy = p.y + Math.sin(a) * s.sword.orbit;
    drawSprite(S[s.sword.sprite], sx, sy, 46, a + Math.PI / 2 + Math.PI / 4);
  }

  // pociski
  ctx.fillStyle = "#fde047";
  for (const b of s.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // kule ognia
  for (const f of s.fireballs) drawSprite(S.fireball, f.x, f.y, 44, f.a);
}

// ===== HUD =====
function updateHud() {
  const s = state;
  const p = s.player;
  timeEl.textContent = s.time.toFixed(1);
  killsEl.textContent = s.kills;
  waveEl.textContent = s.wave;
  levelEl.textContent = p.level;
  const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
  healthFill.style.width = hpPct + "%";
  healthFill.style.background =
    hpPct > 50
      ? "linear-gradient(90deg,#4ade80,#22c55e)"
      : hpPct > 25
      ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
      : "linear-gradient(90deg,#f87171,#ef4444)";
  xpFill.style.width = (p.xp / p.xpNext) * 100 + "%";
}

// ===== Pętla =====
function loop(now) {
  if (!running) return;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;

  if (!paused) update(dt);
  if (running) {
    render();
    updateHud();
    requestAnimationFrame(loop);
  }
}

// ===== Start / koniec =====
function startGame() {
  resize();
  state = newState();
  running = true;
  paused = false;
  lastTime = performance.now();
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  levelupScreen.classList.add("hidden");
  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  paused = false;
  state.over = true;
  joystickEl.classList.add("hidden");
  joy.active = false;

  finalTimeEl.textContent = state.time.toFixed(1);
  finalKillsEl.textContent = state.kills;

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

// hook do testów/debugowania
window.__debug = { S, SR, getState: () => state };

// ===== Init =====
(async function init() {
  resize();
  const names = [
    "player", "small_enemy", "normal_enemy", "big_enemy", "boss",
    "sword", "scythe", "gun", "bomb", "explosion", "shield", "heart", "chest",
  ];
  const imgs = await Promise.all(names.map((n) => loadImage(`assets/${n}.png`)));
  names.forEach((n, i) => (S[n] = imgs[i]));
  S.fireball = await loadImage("assets/fireball.gif");

  // czerwone sylwetki wrogów (miganie po trafieniu)
  SR.small = makeTint(S.small_enemy, "#ff3b3b");
  SR.normal = makeTint(S.normal_enemy, "#ff3b3b");
  SR.big = makeTint(S.big_enemy, "#ff3b3b");
  SR.boss = makeTint(S.boss, "#ff3b3b");
})();
