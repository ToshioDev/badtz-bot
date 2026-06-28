import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, "..", "data", "streaks.json");

let cache = null;
let writing = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw);
  } catch {
    cache = { users: {} };
  }
  return cache;
}

async function persist() {
  // Serializa las escrituras para no corromper el archivo.
  writing = writing.then(async () => {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(cache, null, 2));
  });
  return writing;
}

/** Devuelve YYYY-MM-DD en la zona horaria configurada. */
function todayKey(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function diffDays(a, b) {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

/**
 * Registra actividad de voz de un usuario y actualiza su racha.
 * Devuelve { streak, best, changed, isNewDay }.
 */
export async function recordVoiceActivity(userId, tz) {
  const db = await load();
  const today = todayKey(tz);
  const u = db.users[userId] || { streak: 0, best: 0, lastDay: null, totalDays: 0 };

  if (u.lastDay === today) {
    return { streak: u.streak, best: u.best, changed: false, isNewDay: false };
  }

  if (u.lastDay && diffDays(u.lastDay, today) === 1) {
    u.streak += 1; // día consecutivo
  } else {
    u.streak = 1; // primera vez o racha rota
  }

  u.lastDay = today;
  u.totalDays = (u.totalDays || 0) + 1;
  u.best = Math.max(u.best || 0, u.streak);
  db.users[userId] = u;
  await persist();
  return { streak: u.streak, best: u.best, changed: true, isNewDay: true };
}

export async function getStreak(userId, tz) {
  const db = await load();
  const today = todayKey(tz);
  const u = db.users[userId];
  if (!u) return { streak: 0, best: 0, lastDay: null, totalDays: 0, active: false };
  // Si no entró hoy ni ayer, la racha está en riesgo/rota visualmente.
  const stillAlive = u.lastDay === today || diffDays(u.lastDay, today) === 1;
  return { ...u, active: stillAlive };
}

export async function getLeaderboard(limit = 10) {
  const db = await load();
  return Object.entries(db.users)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.streak - a.streak || b.best - a.best)
    .slice(0, limit);
}

/** IDs de quienes ya hicieron racha hoy (para el recordatorio). */
export async function getDoneTodayIds(tz) {
  const db = await load();
  const today = todayKey(tz);
  return Object.entries(db.users)
    .filter(([, u]) => u.lastDay === today)
    .map(([id]) => id);
}
