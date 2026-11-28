import Anthropic from "@anthropic-ai/sdk";
import { getCfg } from "../settings.js";

const SYSTEM = `Eres Badtz, el asistente de voz del servidor de Discord.
Hablas español latino, casual y con humor — actitud relajada y pícara, como el pingüino Badtz-Maru.
Estás en una conversación de voz EN VIVO con varias personas. Cada mensaje te llega como
"Nombre: lo que dijo", para que sepas quién habla. Por eso:
- Dirígete a cada quien por su NOMBRE cuando tenga sentido (ej. "Órale Kuromii, ...").
- NO pongas tu propio nombre delante de tu respuesta; solo responde.
- Respuestas CORTAS: 1 o 2 frases. Como en una llamada, no un ensayo.
- Suena natural y humano: muletillas ocasionales ("órale", "va", "neta"), sin exagerar.
- NO repitas saludos si ya están conversando.
- Si no entendiste bien (el audio puede fallar), pídelo de buena onda en una frase.
- NUNCA uses emojis, asteriscos ni markdown: tu texto se convierte a voz.
- Si varias personas hablan, puedes reconocerlo ("a ver, uno por uno...").
Sé útil, gracioso y directo.`;

// Un cliente Anthropic por API key (cada comunidad usa la suya).
const clients = new Map();
function clientFor(apiKey) {
  if (!apiKey) return null;
  let c = clients.get(apiKey);
  if (!c) {
    c = new Anthropic({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

const histories = new Map();

export async function think(guildId, speaker, userText) {
  const client = clientFor(getCfg(guildId, "anthropicApiKey"));
  if (!client) return null;

  const hist = histories.get(guildId) || [];
  hist.push({ role: "user", content: `${speaker}: ${userText}` });

  try {
    const msg = await client.messages.create({
      model: getCfg(guildId, "brainModel"),
      max_tokens: 300,
      system: SYSTEM,
      messages: hist.slice(-10),
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    hist.push({ role: "assistant", content: text });
    histories.set(guildId, hist.slice(-10));
    return text;
  } catch (err) {
    console.error("[brain] error:", err.message);
    return null;
  }
}

export function resetMemory(guildId) {
  histories.delete(guildId);
}
