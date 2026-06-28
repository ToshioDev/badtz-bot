import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";
import { onVoiceDown, onVoiceUp } from "./voiceAI.js";

// Estado deseado de "sordo" por servidor, para que las reconexiones lo respeten.
const desiredDeaf = new Map();

function attachReconnect(connection, guild, channelId) {
  connection.removeAllListeners(VoiceConnectionStatus.Disconnected);
  connection.removeAllListeners("stateChange");

  // Resiliencia: al caer/recuperarse la voz, limpia/re-arma el asistente.
  const R = VoiceConnectionStatus.Ready;
  connection.on("stateChange", (oldS, newS) => {
    if (oldS.status === R && newS.status !== R) onVoiceDown(guild.id);
    else if (newS.status === R && oldS.status !== R) onVoiceUp(connection, guild);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      setTimeout(
        () => connectVoice(guild, channelId, { selfDeaf: desiredDeaf.get(guild.id) ?? true }),
        5_000
      );
    }
  });
}

/**
 * Conecta (o reconfigura) al bot en un canal de voz.
 * selfDeaf=true → solo mantener sala abierta; false → poder escuchar (asistente).
 */
export function connectVoice(guild, channelId, { selfDeaf = true } = {}) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) {
    throw new Error(`El canal ${channelId} no existe o no es de voz.`);
  }

  desiredDeaf.set(guild.id, selfDeaf);

  const existing = getVoiceConnection(guild.id);
  if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
    // Reusa la conexión y fuerza el nuevo estado de sordera/canal.
    existing.rejoin({ channelId: channel.id, selfDeaf, selfMute: false });
    attachReconnect(existing, guild, channelId);
    console.log(`[voz] rejoin selfDeaf=${selfDeaf} -> estado ${existing.state.status}`);
    return existing;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf,
    selfMute: false,
  });

  attachReconnect(connection, guild, channelId);
  return connection;
}

export function disconnectVoice(guildId) {
  const conn = getVoiceConnection(guildId);
  if (conn) {
    desiredDeaf.delete(guildId);
    conn.destroy();
    return true;
  }
  return false;
}

export function isConnected(guildId) {
  return Boolean(getVoiceConnection(guildId));
}
