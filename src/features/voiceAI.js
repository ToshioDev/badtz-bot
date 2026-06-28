import {
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  getVoiceConnection,
  entersState,
} from "@discordjs/voice";
import prism from "prism-media";
import ffmpegPath from "ffmpeg-static";
import { transcribe } from "../services/stt.js";
import { think } from "../services/brain.js";
import { synthesize } from "../services/tts.js";
import { config } from "../config.js";
import { getCfg } from "../settings.js";

if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;

const WAKE = /\b(badt?z|bads?|baz|batch|bat|vatos?)\b/i;
const FAREWELL = /\b(gracias|adi[oó]s|ad[ií]os|chao|chau|bye|nos vemos|ya est[aá]|es todo|nada m[aá]s)\b/i;

const SR = 48000;
const CH = 2;

const players = new Map(); // guildId -> AudioPlayer
const capturing = new Set(); // "guildId:userId" capturando ahora (varios en paralelo)
const enabled = new Set(); // guildIds con asistente activo
const wired = new WeakSet(); // receivers ya conectados
const convoUntil = new Map(); // guildId -> ts hasta el que sigue la charla sin palabra clave
const muteUntil = new Map(); // guildId -> ts cooldown corto post-voz
const botSpeaking = new Set(); // guildIds donde el bot habla ahora (para barge-in)
const lastReply = new Map(); // guildId -> { text, at } para rechazar eco
const replyChain = new Map(); // guildId -> Promise (serializa la reproducción)
const pendingReplies = new Map(); // guildId -> nº de respuestas en cola

function ensurePlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
    player.on(AudioPlayerStatus.Idle, () => {
      botSpeaking.delete(guildId);
      muteUntil.set(guildId, Date.now() + 400); // mini cooldown contra coletazo de eco
    });
    player.on("error", (e) => console.error("[voiceAI] player error:", e.message));
  }
  return player;
}

export async function startVoiceAI(connection, guild) {
  enabled.add(guild.id);
  convoUntil.set(guild.id, Date.now() + 30_000); // al entrar puedes hablar directo

  const player = ensurePlayer(guild.id);
  connection.subscribe(player);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch {
    console.log("[voiceAI] ❌ conexión no llegó a Ready");
  }

  wireReceiver(connection, guild, player);
}

// Conecta el listener de voz al receiver (idempotente: una vez por receiver).
function wireReceiver(connection, guild, player) {
  const receiver = connection.receiver;
  if (wired.has(receiver)) return;
  wired.add(receiver);
  console.log("[voiceAI] 🎙️ escuchando en", guild.name);

  receiver.speaking.on("start", (userId) => {
    if (!enabled.has(guild.id)) return;
    const key = `${guild.id}:${userId}`;
    if (capturing.has(key)) return; // ya capturando a esta persona
    if (Date.now() < (muteUntil.get(guild.id) ?? 0)) return; // cooldown corto post-voz

    const member = guild.members.cache.get(userId);
    if (member?.user?.bot) return;

    capturing.add(key);
    handleUtterance(receiver, userId, guild, player).finally(() => capturing.delete(key));
  });
}

// La voz se cayó: corta reproducción colgada y limpia estado (no quedar "sordo").
export function onVoiceDown(guildId) {
  botSpeaking.delete(guildId);
  const p = players.get(guildId);
  if (p) { try { p.stop(true); } catch {} }
}

// La voz volvió: re-suscribe el reproductor, re-arma el listener y resetea estado atascado.
export function onVoiceUp(connection, guild) {
  if (!enabled.has(guild.id)) return;
  const player = ensurePlayer(guild.id);
  try { connection.subscribe(player); } catch {}
  botSpeaking.delete(guild.id);
  muteUntil.delete(guild.id);
  pendingReplies.set(guild.id, 0);
  for (const k of [...capturing]) if (k.startsWith(guild.id + ":")) capturing.delete(k);
  wireReceiver(connection, guild, player);
  console.log("[voiceAI] 🔁 voz reconectada, asistente re-armado en", guild.name);
}

export function stopVoiceAI(guildId) {
  enabled.delete(guildId);
  convoUntil.delete(guildId);
  muteUntil.delete(guildId);
  botSpeaking.delete(guildId);
  pendingReplies.delete(guildId);
  const player = players.get(guildId);
  if (player) player.stop(true);
}

export function isVoiceAIEnabled(guildId) {
  return enabled.has(guildId);
}

function rms(buf) {
  const n = buf.length >> 1;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const s = buf.readInt16LE(i);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

const msOf = (buf) => (buf.length / (SR * CH * 2)) * 1000;

function norm(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similar(a, b) {
  const wa = new Set(norm(a).split(" ").filter(Boolean));
  const wb = norm(b).split(" ").filter(Boolean);
  if (!wb.length || !wa.size) return 0;
  let hit = 0;
  for (const w of wb) if (wa.has(w)) hit++;
  return hit / wb.length;
}

async function handleUtterance(receiver, userId, guild, player) {
  const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual } });
  const decoder = new prism.opus.Decoder({ rate: SR, channels: CH, frameSize: 960 });
  const chunks = [];

  let hasSpeech = false;
  let voicedMs = 0;
  let lastVoice = Date.now();
  let start = Date.now();
  let peak = 0;

  // Ajustes (configurables por servidor con /config).
  const sThreshold = getCfg(guild.id, "vadThreshold");
  const sBargeThreshold = getCfg(guild.id, "vadBargeThreshold");
  const sSilenceMs = getCfg(guild.id, "vadSilenceMs");
  const sMinSpeechMs = getCfg(guild.id, "vadMinSpeechMs");
  const sBargeMinMs = getCfg(guild.id, "bargeMinMs");
  const sMaxMs = config.vadMaxMs;

  const barge = botSpeaking.has(guild.id);
  let threshold = barge ? sBargeThreshold : sThreshold;
  let interrupted = false;

  await new Promise((resolve) => {
    let done = false;
    let iv;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(iv);
      try { opusStream.destroy(); } catch {}
      resolve();
    };
    opusStream.on("error", finish);
    decoder.on("error", finish);
    decoder.on("end", finish);
    decoder.on("data", (c) => {
      chunks.push(c);
      const e = rms(c);
      if (e > peak) peak = e;
      if (e > threshold) {
        hasSpeech = true;
        voicedMs += msOf(c);
        lastVoice = Date.now();
        if (barge && !interrupted && voicedMs >= sBargeMinMs) {
          interrupted = true;
          const p = players.get(guild.id);
          if (p) p.stop(true);
          botSpeaking.delete(guild.id);
          threshold = sThreshold;
          chunks.length = 0;
          voicedMs = 0;
          hasSpeech = false;
          start = Date.now();
          console.log("[voiceAI] ✋ barge-in");
        }
      }
    });
    opusStream.pipe(decoder);

    iv = setInterval(() => {
      const now = Date.now();
      if (hasSpeech && now - lastVoice > sSilenceMs) finish();
      else if (!hasSpeech && now - start > 3000) finish();
      else if (now - start > sMaxMs) finish();
    }, 100);
  });

  if (!hasSpeech || voicedMs < sMinSpeechMs) return;

  const text = await transcribe(pcmToWav(Buffer.concat(chunks), SR, CH), getCfg(guild.id, "groqApiKey"));
  if (!text) return;
  const clean = text.trim();
  if (clean.length < 2) return;

  // Rechazo de eco (el bot oyéndose a sí mismo por las bocinas).
  const prev = lastReply.get(guild.id);
  if (prev && Date.now() - prev.at < 9000 && similar(clean, prev.text) > 0.55) {
    console.log("[voiceAI] 🔇 eco descartado");
    return;
  }

  // ¿Le hablan al bot? (palabra clave o conversación en curso)
  const inConvo = (convoUntil.get(guild.id) ?? 0) > Date.now();
  const m = WAKE.exec(clean);
  let prompt;
  if (m) prompt = clean.slice(m.index + m[0].length).replace(/^[\s,.:;!?¿¡]+/, "").trim();
  else if (inConvo) prompt = clean;
  else return;
  if (!prompt) prompt = "Hola, ¿qué tal?";

  const speaker = guild.members.cache.get(userId)?.displayName ?? "Alguien";
  console.log(`[voiceAI] 👤 ${speaker}: "${clean}"`);

  // Encola la respuesta (reproducción en serie para no encimar audio).
  enqueueCapped(guild.id, () => respondAndSpeak(guild, player, speaker, prompt));
}

/** Pone una tarea en la cola del servidor, con tope de 3 pendientes. */
function enqueueCapped(guildId, task) {
  const count = pendingReplies.get(guildId) ?? 0;
  if (count >= 3) {
    console.log("[voiceAI] cola llena, ignoro");
    return false;
  }
  pendingReplies.set(guildId, count + 1);
  const prev = replyChain.get(guildId) ?? Promise.resolve();
  const next = prev
    .then(task)
    .catch((e) => console.error("[voiceAI] cola:", e.message))
    .finally(() => pendingReplies.set(guildId, Math.max(0, (pendingReplies.get(guildId) ?? 1) - 1)));
  replyChain.set(guildId, next);
  return true;
}

/**
 * Reproduce texto por TTS en el canal de voz del servidor (para #mudos o /decir).
 * Devuelve false si el bot no está en un canal de voz.
 */
export function speakText(guild, text) {
  const conn = getVoiceConnection(guild.id);
  if (!conn) return false;
  const player = ensurePlayer(guild.id);
  conn.subscribe(player);
  return enqueueCapped(guild.id, () => playReply(guild.id, player, text));
}

async function respondAndSpeak(guild, player, speaker, prompt) {
  const reply = await think(guild.id, speaker, prompt);
  if (!reply) return;
  console.log(`[voiceAI] 🤖 Badtz → ${speaker}: "${reply}"`);

  if (FAREWELL.test(prompt)) convoUntil.delete(guild.id);
  else convoUntil.set(guild.id, Date.now() + getCfg(guild.id, "conversationWindowMs"));

  await playReply(guild.id, player, reply);
}

/** Sintetiza y reproduce un texto, esperando a que termine (serializa la cola). */
async function playReply(guildId, player, text) {
  let audio;
  try {
    audio = await synthesize(text, getCfg(guildId, "ttsVoice"));
  } catch (err) {
    console.error("[voiceAI] tts:", err.message);
    return;
  }

  lastReply.set(guildId, { text, at: Date.now() });
  botSpeaking.add(guildId);

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      player.off(AudioPlayerStatus.Idle, onIdle);
      clearTimeout(timer);
      resolve();
    };
    const onIdle = () => done();
    const timer = setTimeout(done, 20_000); // seguridad: nunca quedarse colgado
    player.on(AudioPlayerStatus.Idle, onIdle);
    try {
      player.play(createAudioResource(audio, { inputType: StreamType.Arbitrary }));
    } catch (err) {
      console.error("[voiceAI] play:", err.message);
      done();
    }
  });
  botSpeaking.delete(guildId); // garantiza que NO quede "hablando" colgado
}

function pcmToWav(pcm, sampleRate, channels) {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
