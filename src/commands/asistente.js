import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { startVoiceAI, stopVoiceAI, isVoiceAIEnabled } from "../features/voiceAI.js";
import { connectVoice } from "../features/voice247.js";
import { resetMemory } from "../services/brain.js";
import { aiReady } from "../settings.js";

export const data = new SlashCommandBuilder()
  .setName("asistente")
  .setDescription("Activa el asistente de voz con IA (di \"Badtz...\" para hablarle)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s
      .setName("entrar")
      .setDescription("El bot entra a tu canal de voz y escucha")
      .addChannelOption((o) =>
        o
          .setName("canal")
          .setDescription("Canal de voz (por defecto el tuyo)")
          .addChannelTypes(ChannelType.GuildVoice)
      )
  )
  .addSubcommand((s) => s.setName("salir").setDescription("El asistente deja de escuchar"))
  .addSubcommand((s) => s.setName("olvidar").setDescription("Borra la memoria de la conversación"))
  .addSubcommand((s) => s.setName("estado").setDescription("¿El asistente está activo?"));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "entrar") {
    if (!aiReady(interaction.guild.id)) {
      return interaction.reply({
        content:
          "⚠️ Este servidor aún no tiene la IA configurada. Un admin debe poner las API keys de **Claude** y **Groq** en el panel web (o con `/config`). Groq es gratis en console.groq.com.",
        ephemeral: true,
      });
    }

    const canal = interaction.options.getChannel("canal") ?? interaction.member?.voice?.channel;
    if (!canal) {
      return interaction.reply({
        content: "⚠️ Únete a un canal de voz primero, o pásalo con la opción `canal`.",
        ephemeral: true,
      });
    }

    // Conexión con selfDeaf=false para PODER escuchar el audio.
    const connection = connectVoice(interaction.guild, canal.id, { selfDeaf: false });
    startVoiceAI(connection, interaction.guild);
    return interaction.reply({
      content: `🎙️ Asistente activo en **${canal.name}**. Habla normal y te responde por voz (no hace falta decir "Badtz"). Usa \`/asistente salir\` para que deje de escuchar.`,
      ephemeral: true,
    });
  }

  if (sub === "salir") {
    stopVoiceAI(interaction.guild.id);
    return interaction.reply({
      content: "🔇 El asistente dejó de escuchar. (Usa `/voz247 salir` si quieres que salga del canal.)",
      ephemeral: true,
    });
  }

  if (sub === "olvidar") {
    resetMemory(interaction.guild.id);
    return interaction.reply({ content: "🧠 Memoria borrada. Empezamos de cero.", ephemeral: true });
  }

  if (sub === "estado") {
    return interaction.reply({
      content: isVoiceAIEnabled(interaction.guild.id)
        ? "🟢 El asistente está activo y escuchando."
        : "⚪ El asistente no está activo. Usa `/asistente entrar`.",
      ephemeral: true,
    });
  }
}
