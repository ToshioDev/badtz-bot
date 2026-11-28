import { config } from "../config.js";

/**
 * Transcribe audio (WAV buffer) con Whisper en Groq.
 * groqKey: la API key de la comunidad (BYO). Si no hay, devuelve null.
 */
export async function transcribe(wavBuffer, groqKey = config.groqApiKey) {
  if (!groqKey) return null;
  try {
    const form = new FormData();
    form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
    form.append("model", config.groqSttModel);
    form.append("language", "es");
    form.append("temperature", "0");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!res.ok) {
      console.error("[stt] Groq", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return (data.text || "").trim();
  } catch (err) {
    console.error("[stt] error:", err.message);
    return null;
  }
}
