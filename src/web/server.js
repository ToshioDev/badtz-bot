import express from "express";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ChannelType, PermissionsBitField } from "discord.js";
import { config } from "../config.js";
import { getAll, setMany, resetCfg } from "../settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VOICES = [
  { name: "Jorge (MX, hombre)", value: "es-MX-JorgeNeural" },
  { name: "Dalia (MX, mujer)", value: "es-MX-DaliaNeural" },
  { name: "Alonso (latino, hombre)", value: "es-US-AlonsoNeural" },
  { name: "Paloma (latino, mujer)", value: "es-US-PalomaNeural" },
  { name: "Tomás (Argentina)", value: "es-AR-TomasNeural" },
  { name: "Gonzalo (Colombia)", value: "es-CO-GonzaloNeural" },
];
const MODELS = [
  { name: "Haiku 4.5 (rápido, ideal voz)", value: "claude-haiku-4-5" },
  { name: "Sonnet 4.6 (más ingenioso)", value: "claude-sonnet-4-6" },
  { name: "Opus 4.8 (el más inteligente)", value: "claude-opus-4-8" },
];

const EDITABLE = new Set([
  "voice247ChannelId", "joinToCreateChannelId", "mudosChannelId",
  "streakReminderChannelId", "streakReminderRoleId", "ttsVoice", "brainModel",
  "anthropicApiKey", "groqApiKey", "conversationWindowMs",
  "vadThreshold", "vadSilenceMs", "vadMinSpeechMs", "vadBargeThreshold", "bargeMinMs",
]);
const NUMERIC = new Set([
  "conversationWindowMs", "vadThreshold", "vadSilenceMs", "vadMinSpeechMs",
  "vadBargeThreshold", "bargeMinMs",
]);
const SECRET_KEYS = new Set(["anthropicApiKey", "groqApiKey"]); // no se devuelven al cliente

const sessions = new Map(); // token -> { user, guilds:Set, exp }
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function baseUrl() {
  return config.baseUrl || `http://localhost:${config.webPort}`;
}
function redirectUri() {
  return `${baseUrl()}/api/auth/callback`;
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function startWebServer(client) {
  if (!config.discordClientSecret) {
    console.log("[web] DISCORD_CLIENT_SECRET vacío: panel web desactivado (ponlo en .env para activarlo).");
    return;
  }

  const app = express();
  app.use(express.json());

  const getSession = (req) => {
    const t = parseCookies(req).badtz_sess;
    const s = t && sessions.get(t);
    if (!s || s.exp < Date.now()) return null;
    return s;
  };

  // --- OAuth2 con Discord ---
  app.get("/api/auth/login", (req, res) => {
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("scope", "identify guilds");
    res.redirect(url.toString());
  });

  app.get("/api/auth/callback", async (req, res) => {
    try {
      const code = req.query.code;
      if (!code) return res.redirect("/");
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.discordClientSecret,
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: redirectUri(),
        }),
      });
      const tok = await tokenRes.json();
      if (!tok.access_token) return res.redirect("/?error=auth");

      const headers = { Authorization: `Bearer ${tok.access_token}` };
      const [me, guilds] = await Promise.all([
        fetch("https://discord.com/api/users/@me", { headers }).then((r) => r.json()),
        fetch("https://discord.com/api/users/@me/guilds", { headers }).then((r) => r.json()),
      ]);

      // Servidores donde el usuario es admin / puede gestionar.
      const ADMIN = PermissionsBitField.Flags.Administrator;
      const MANAGE = PermissionsBitField.Flags.ManageGuild;
      const adminGuilds = new Set(
        (Array.isArray(guilds) ? guilds : [])
          .filter((g) => {
            const p = BigInt(g.permissions || 0);
            return g.owner || (p & ADMIN) === ADMIN || (p & MANAGE) === MANAGE;
          })
          .map((g) => g.id)
      );

      const token = randomUUID();
      sessions.set(token, {
        user: { id: me.id, username: me.global_name || me.username, avatar: me.avatar },
        guilds: adminGuilds,
        exp: Date.now() + SESSION_MS,
      });

      const secure = baseUrl().startsWith("https") ? "; Secure" : "";
      res.setHeader(
        "Set-Cookie",
        `badtz_sess=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MS / 1000}; SameSite=Lax${secure}`
      );
      res.redirect("/");
    } catch (e) {
      console.error("[web] auth:", e.message);
      res.redirect("/?error=auth");
    }
  });

  app.post("/api/logout", (req, res) => {
    const t = parseCookies(req).badtz_sess;
    if (t) sessions.delete(t);
    res.setHeader("Set-Cookie", "badtz_sess=; HttpOnly; Path=/; Max-Age=0");
    res.json({ ok: true });
  });

  // ¿Quién soy y qué servidores puedo configurar? (admin del user ∩ presencia del bot)
  app.get("/api/me", (req, res) => {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: "no autenticado" });
    const manageable = [];
    for (const id of s.guilds) {
      const g = client.guilds.cache.get(id);
      if (g) manageable.push({ id: g.id, name: g.name, icon: g.iconURL?.() || null });
    }
    res.json({ user: s.user, guilds: manageable });
  });

  // Middleware: requiere sesión + ser admin del ?guild=
  const guildAuth = (req, res, next) => {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: "no autenticado" });
    const gid = req.query.guild || req.body?.guild;
    if (!gid || !s.guilds.has(gid) || !client.guilds.cache.get(gid)) {
      return res.status(403).json({ error: "sin acceso a ese servidor" });
    }
    req.gid = gid;
    next();
  };

  app.get("/api/options", guildAuth, async (req, res) => {
    try {
      const guild = await client.guilds.fetch(req.gid);
      const chs = await guild.channels.fetch();
      const text = [];
      const voice = [];
      for (const c of chs.values()) {
        if (!c) continue;
        if (c.type === ChannelType.GuildText) text.push({ id: c.id, name: c.name });
        else if (c.type === ChannelType.GuildVoice) voice.push({ id: c.id, name: c.name });
      }
      const roles = [];
      const rs = await guild.roles.fetch();
      for (const r of rs.values()) if (r.name !== "@everyone") roles.push({ id: r.id, name: r.name });

      // No mandamos las keys; solo si están puestas o no.
      const s = getAll(req.gid);
      const safe = { ...s };
      for (const k of SECRET_KEYS) safe[k] = s[k] ? "__set__" : "";

      res.json({ guildName: guild.name, text, voice, roles, voices: VOICES, models: MODELS, settings: safe });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/settings", guildAuth, (req, res) => {
    const body = req.body || {};
    const patch = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === "guild" || !EDITABLE.has(k)) continue;
      // Las keys secretas: si llega el placeholder, no las toques.
      if (SECRET_KEYS.has(k) && v === "__set__") continue;
      let val = v === "" || v === null ? null : v;
      if (val !== null && NUMERIC.has(k)) val = Number(val);
      patch[k] = val;
    }
    setMany(req.gid, patch);
    res.json({ ok: true });
  });

  app.post("/api/reset", guildAuth, (req, res) => {
    resetCfg(req.gid);
    res.json({ ok: true });
  });

  // Estáticos (panel) al final + fallback SPA (Express 5: sin comodín "*").
  app.use(express.static(resolve(__dirname, "public")));
  app.use((req, res) => res.sendFile(resolve(__dirname, "public", "index.html")));

  app.listen(config.webPort, "0.0.0.0", () => {
    console.log(`[web] 🌐 panel SaaS en ${baseUrl()}`);
  });
}
