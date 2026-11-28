import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { setCfg } from "../settings.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Crea y enlaza todos los canales del bot automáticamente")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const all = await guild.channels.fetch();
  const log = [];

  // Busca un canal por nombre+tipo, o lo crea.
  async function ensure(name, type, parent, extra = {}) {
    let ch = all.find(
      (c) => c && c.type === type && c.name.toLowerCase().includes(name.toLowerCase())
    );
    if (!ch) {
      ch = await guild.channels.create({ name, type, parent: parent ?? null, ...extra });
      log.push(`• creado **${ch.name}**`);
    }
    return ch;
  }

  // Categorías
  const catTexto = await ensure("Texto", ChannelType.GuildCategory);
  const catVoz = await ensure("Voz", ChannelType.GuildCategory);

  // Canales de texto
  const general = await ensure("general", ChannelType.GuildText, catTexto.id);
  await ensure("juegos", ChannelType.GuildText, catTexto.id);
  await ensure("música", ChannelType.GuildText, catTexto.id);
  await ensure("videos", ChannelType.GuildText, catTexto.id);
  const mudos = await ensure("🔇-mudos", ChannelType.GuildText, catTexto.id, {
    topic: "Escribe aquí y el bot lo dice en voz alta (para quien no tiene micrófono).",
  });

  // Canales de voz
  const lounge = await ensure("Lounge", ChannelType.GuildVoice, catVoz.id);
  const crearSala = await ensure("➕ Crear sala", ChannelType.GuildVoice, catVoz.id);
  await ensure("Sala de transmisión", ChannelType.GuildVoice, catVoz.id);

  // Enlaza todo en la configuración
  setCfg(guild.id, "voice247ChannelId", lounge.id);
  setCfg(guild.id, "joinToCreateChannelId", crearSala.id);
  setCfg(guild.id, "mudosChannelId", mudos.id);
  setCfg(guild.id, "streakReminderChannelId", general.id);

  await interaction.editReply(
    `✅ **Setup completo.**\n` +
      (log.length ? log.join("\n") + "\n\n" : "Todo ya existía.\n\n") +
      `Enlazado automáticamente:\n` +
      `🔊 Voz 24/7 → ${lounge}\n` +
      `➕ Crear sala → ${crearSala}\n` +
      `🔇 Mudos → ${mudos}\n` +
      `🔥 Recordatorio → ${general}\n\n` +
      `Reinicia el bot para activar la voz 24/7 en el canal nuevo, o úsalo ya con \`/asistente entrar\`. ` +
      `Mira todo con \`/config ver\`.`
  );
}
