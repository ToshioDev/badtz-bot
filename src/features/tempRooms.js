import { ChannelType, PermissionFlagsBits } from "discord.js";
import { getCfg } from "../settings.js";

// Guarda los canales temporales creados para borrarlos al quedar vacíos.
const tempChannels = new Set();

/**
 * "Join to create": cuando un miembro entra al canal disparador,
 * el bot le crea una sala de voz propia y lo mueve ahí.
 * Al quedar vacía, se borra sola.
 */
export function setupTempRooms(client) {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      const joinToCreateChannelId = getCfg(newState.guild.id, "joinToCreateChannelId");
      // Entró al canal disparador -> crear sala
      if (joinToCreateChannelId && newState.channelId === joinToCreateChannelId && newState.member) {
        const guild = newState.guild;
        const trigger = guild.channels.cache.get(joinToCreateChannelId);
        const member = newState.member;

        const channel = await guild.channels.create({
          name: `🔊 Sala de ${member.displayName}`,
          type: ChannelType.GuildVoice,
          parent: trigger?.parentId ?? null,
          permissionOverwrites: [
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
              ],
            },
          ],
        });

        tempChannels.add(channel.id);
        await member.voice.setChannel(channel).catch(() => {});
      }

      // Salió de una sala temporal que quedó vacía -> borrar
      const left = oldState.channel;
      if (left && tempChannels.has(left.id) && left.members.size === 0) {
        tempChannels.delete(left.id);
        await left.delete("Sala temporal vacía").catch(() => {});
      }
    } catch (err) {
      console.error("[tempRooms] error:", err.message);
    }
  });
}
