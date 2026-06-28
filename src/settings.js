import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "data", "badtz.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
)`);

// Cache en memoria de todos los overrides por servidor (lecturas síncronas y rápidas).
const cache = new Map();
for (const row of db.prepare("SELECT guild_id, data FROM guild_settings").all()) {
  try {
    cache.set(row.guild_id, JSON.parse(row.data));
  } catch {
    cache.set(row.guild_id, {});
  }
}

const upsert = db.prepare(
  "INSERT INTO guild_settings (guild_id, data) VALUES (?, ?) " +
    "ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data"
);
const del = db.prepare("DELETE FROM guild_settings WHERE guild_id = ?");

// Defaults GLOBALES (iguales para todo servidor). Los canales y las API keys
// NO van aquí: son por-servidor (cada comunidad pone los suyos). Así no se
// filtran tus keys/canales del .env a otras comunidades en el SaaS.
function defaults() {
  return {
    voice247ChannelId: null,
    joinToCreateChannelId: null,
    streakReminderChannelId: null,
    streakReminderRoleId: null,
    mudosChannelId: null,
    anthropicApiKey: null,
    groqApiKey: null,
    ttsVoice: config.ttsVoice,
    brainModel: config.brainModel,
    conversationWindowMs: config.conversationWindowMs,
    vadThreshold: config.vadThreshold,
    vadSilenceMs: config.vadSilenceMs,
    vadMinSpeechMs: config.vadMinSpeechMs,
    vadBargeThreshold: config.vadBargeThreshold,
    bargeMinMs: config.bargeMinMs,
  };
}

// Migración única: si tu servidor (GUILD_ID del .env) trae valores en el .env,
// los siembra en la DB una sola vez para que tu server siga funcionando igual.
(function seedOwnGuild() {
  if (!config.guildId) return;
  const row = cache.get(config.guildId) || {};
  if (row._seeded) return;
  const fromEnv = {
    voice247ChannelId: config.voice247ChannelId,
    joinToCreateChannelId: config.joinToCreateChannelId,
    streakReminderChannelId: config.streakReminderChannelId,
    streakReminderRoleId: config.streakReminderRoleId,
    mudosChannelId: config.ttsRelayChannelId,
    anthropicApiKey: config.anthropicApiKey,
    groqApiKey: config.groqApiKey,
  };
  for (const [k, v] of Object.entries(fromEnv)) if (v) row[k] = v;
  row._seeded = true;
  cache.set(config.guildId, row);
  upsert.run(config.guildId, JSON.stringify(row));
})();

export function getCfg(guildId, key) {
  const g = cache.get(guildId);
  if (g && g[key] !== undefined && g[key] !== null && g[key] !== "") return g[key];
  return defaults()[key];
}

export function setCfg(guildId, key, value) {
  const g = cache.get(guildId) || {};
  if (value === null || value === undefined || value === "") delete g[key];
  else g[key] = value;
  cache.set(guildId, g);
  upsert.run(guildId, JSON.stringify(g));
}

/** Aplica varios ajustes de golpe. */
export function setMany(guildId, obj) {
  const g = cache.get(guildId) || {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") delete g[k];
    else g[k] = v;
  }
  cache.set(guildId, g);
  upsert.run(guildId, JSON.stringify(g));
}

export function getAll(guildId) {
  return { ...defaults(), ...(cache.get(guildId) || {}) };
}

export function resetCfg(guildId) {
  cache.delete(guildId);
  del.run(guildId);
}

/** ¿Tiene este servidor configuradas las keys de IA? (para saber si la voz IA está lista) */
export function aiReady(guildId) {
  return Boolean(getCfg(guildId, "anthropicApiKey") && getCfg(guildId, "groqApiKey"));
}
