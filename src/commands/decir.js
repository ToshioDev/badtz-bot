import { SlashCommandBuilder } from "discord.js";
import { speakText } from "../features/voiceAI.js";

export const data = new SlashCommandBuilder()
  .setName("decir")
  .setDescription("El bot dice tu texto en voz alta (para quien no tiene micrófono)")
  .addStringOption((o) =>
    o.setName("texto").setDescription("Lo que quieres que diga").setRequired(true).setMaxLength(400)
  );

export async function execute(interaction) {
  const texto = interaction.options.getString("texto");
  const ok = speakText(interaction.guild, texto);
  return interaction.reply({
    content: ok
      ? `🗣️ Diciendo: "${texto}"`
      : "🔇 No estoy en un canal de voz. Méteme con `/asistente entrar` o `/voz247 entrar` primero.",
    ephemeral: true,
  });
}
