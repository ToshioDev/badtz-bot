import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { connectVoice, disconnectVoice, isConnected } from "../features/voice247.js";

export const data = new SlashCommandBuilder()
  .setName("voz247")
  .setDescription("Mantén el bot en un canal de voz para que la sala no cierre")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s
      .setName("entrar")
      .setDescription("El bot entra y se queda en un canal de voz")
      .addChannelOption((o) =>
        o
          .setName("canal")
          .setDescription("Canal de voz (por defecto en el que estás)")
          .addChannelTypes(ChannelType.GuildVoice)
      )
  )
  .addSubcommand((s) => s.setName("salir").setDescription("El bot sale del canal de voz"))
  .addSubcommand((s) => s.setName("estado").setDescription("¿El bot está manteniendo una sala?"));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "entrar") {
    const canal =
      interaction.options.getChannel("canal") ?? interaction.member?.voice?.channel;
    if (!canal) {
      return interaction.reply({
        content: "⚠️ Únete a un canal de voz o pásalo con la opción `canal`.",
        ephemeral: true,
      });
    }
    try {
      connectVoice(interaction.guild, canal.id);
      return interaction.reply({ content: `🟢 Manteniendo abierto **${canal.name}** 24/7.`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
  }

  if (sub === "salir") {
    const ok = disconnectVoice(interaction.guild.id);
    return interaction.reply({
      content: ok ? "🔴 El bot salió del canal de voz." : "El bot no estaba en ningún canal.",
      ephemeral: true,
    });
  }

  if (sub === "estado") {
    return interaction.reply({
      content: isConnected(interaction.guild.id)
        ? "🟢 El bot está manteniendo una sala abierta."
        : "⚪ El bot no está en ningún canal de voz.",
      ephemeral: true,
    });
  }
}
