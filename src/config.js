import "dotenv/config";

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  voice247ChannelId: process.env.VOICE_24_7_CHANNEL_ID || null,
  joinToCreateChannelId: process.env.JOIN_TO_CREATE_CHANNEL_ID || null,
  streakReminderChannelId: process.env.STREAK_REMINDER_CHANNEL_ID || null,
  ttsRelayChannelId: process.env.MUDOS_CHANNEL_ID || null, // canal #mudos: texto -> voz
  streakReminderCron: process.env.STREAK_REMINDER_CRON || "0 20 * * *",
  streakReminderRoleId: process.env.STREAK_REMINDER_ROLE_ID || null,
  tz: process.env.TZ || "America/Puerto_Rico",

  // === Asistente de voz con IA ===
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  groqApiKey: process.env.GROQ_API_KEY || null,
  brainModel: process.env.BRAIN_MODEL || "claude-haiku-4-5",
  groqSttModel: process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo",
  ttsVoice: process.env.TTS_VOICE || "es-MX-JorgeNeural",

  // === Detección de voz (VAD) para conversación natural ===
  vadThreshold: Number(process.env.VAD_THRESHOLD || 600), // energía mínima = voz
  vadSilenceMs: Number(process.env.VAD_SILENCE_MS || 1000), // silencio = fin de frase
  vadMinSpeechMs: Number(process.env.VAD_MIN_SPEECH_MS || 160), // mínimo para no ser ruido
  vadMaxMs: Number(process.env.VAD_MAX_MS || 20000), // tope de grabación
  conversationWindowMs: Number(process.env.CONVERSATION_WINDOW_MS || 15000), // seguir sin palabra clave

  // === Barge-in (interrumpir al bot mientras habla) ===
  vadBargeThreshold: Number(process.env.VAD_BARGE_THRESHOLD || 1600), // voz fuerte para interrumpir
  bargeMinMs: Number(process.env.BARGE_MIN_MS || 300), // voz sostenida para confirmar interrupción

  // === Panel web SaaS (login con Discord) ===
  webPort: Number(process.env.PORT || process.env.WEB_PORT || 8787),
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || null, // OAuth2 del panel
  baseUrl: process.env.BASE_URL || null, // URL pública (Railway). Local: auto localhost
};

export function assertConfig() {
  // En SaaS solo el token y el CLIENT_ID son obligatorios (GUILD_ID es opcional).
  const missing = ["token", "clientId"].filter((k) => !config[k]);
  if (missing.length) {
    const map = { token: "DISCORD_TOKEN", clientId: "CLIENT_ID" };
    throw new Error(
      `Faltan variables de entorno obligatorias: ${missing.map((k) => map[k]).join(", ")}. ` +
        `Cópialas de .env.example a .env (local) o configúralas en Railway.`
    );
  }
}
