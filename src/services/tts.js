import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { config } from "../config.js";

/**
 * Convierte texto a voz usando edge-tts (voces neuronales de Microsoft, gratis,
 * sin API key). Devuelve un stream de audio MP3 listo para reproducir.
 */
export async function synthesize(text, voice = config.ttsVoice) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const result = tts.toStream(text);
  // Distintas versiones de la librería devuelven { audioStream } o el stream directo.
  return result?.audioStream ?? result;
}
