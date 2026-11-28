import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { getAll, setCfg, resetCfg } from "../settings.js";

const VOICES = [
  { name: "Jorge (MX, hombre)", value: "es-MX-JorgeNeural" },
  { name: "Dalia (MX, mujer)", value: "es-MX-DaliaNeural" },
  { name: "Alonso (latino, hombre)", value: "es-US-AlonsoNeural" },
  { name: "Paloma (latino, mujer)", value: "es-US-PalomaNeural" },
  { name: "Tomás (Argentina)", value: "es-AR-TomasNeural" },
  { name: "Gonzalo (Colombia)", value: "es-CO-GonzaloNeural" },
];

const MODELS = [
  { name: "Haiku 4.5 (rápido, barato — ideal voz)", value: "claude-haiku-4-5" },
  { name: "Sonnet 4.6 (más ingenioso)", value: "claude-sonnet-4-6" },
  { name: "Opus 4.8 (el más inteligente)", value: "claude-opus-4-8" },
];

const SENS = {
  alta: { vadThreshold: 400, vadMinSpeechMs: 120 }, // oye fácil
  normal: { vadThreshold: 600, vadMinSpeechMs: 160 },
  baja: { vadThreshold: 950, vadMinSpeechMs: 280 }, // filtra más ruido
};

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configura el bot (canales, voz, IA, sensibilidad)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName("ver").setDescription("Muestra toda la configuración actual"))
  .addSubcommand((s) =>
    s
      .setName("canal")
      .setDescription("Asigna un canal a una función")
      .addStringOption((o) =>
        o
          .setName("funcion")
          .setDescription("Para qué sirve el canal")
          .setRequired(true)
          .addChoices(
            { name: "Voz 24/7 (mantener abierta)", value: "voice247ChannelId" },
            { name: "Crear sala (salas temporales)", value: "joinToCreateChannelId" },
            { name: "Recordatorio de racha", value: "streakReminderChannelId" },
            { name: "Mudos (texto a voz)", value: "mudosChannelId" }
          )
      )
      .addChannelOption((o) =>
        o.setName("canal").setDescription("El canal (vacío = quitar)").addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice
        )
      )
  )
  .addSubcommand((s) =>
    s
      .setName("voz")
      .setDescription("Cambia la voz del bot")
      .addStringOption((o) =>
        o.setName("voz").setDescription("Voz").setRequired(true).addChoices(...VOICES)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("modelo")
      .setDescription("Cambia el modelo de IA (cerebro)")
      .addStringOption((o) =>
        o.setName("modelo").setDescription("Modelo").setRequired(true).addChoices(...MODELS)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("sensibilidad")
      .setDescription("Qué tan fácil te escucha vs filtra ruido")
      .addStringOption((o) =>
        o
          .setName("nivel")
          .setDescription("Nivel")
          .setRequired(true)
          .addChoices(
            { name: "Alta (oye fácil)", value: "alta" },
            { name: "Normal", value: "normal" },
            { name: "Baja (filtra más ruido)", value: "baja" }
          )
      )
  )
  .addSubcommand((s) =>
    s
      .setName("conversacion")
      .setDescription("Segundos que sigue escuchando sin decir 'Badtz'")
      .addIntegerOption((o) =>
        o.setName("segundos").setDescription("5 a 60").setRequired(true).setMinValue(5).setMaxValue(60)
      )
  )
  .addSubcommand((s) =>
    s.setName("rol-recordatorio").setDescription("Rol al que se le hace ping en el recordatorio")
      .addRoleOption((o) => o.setName("rol").setDescription("Rol (vacío = @here)"))
  )
  .addSubcommand((s) => s.setName("reset").setDescription("Vuelve todo a los valores por defecto"));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const gid = interaction.guild.id;

  if (sub === "ver") {
    const c = getAll(gid);
    const ch = (id) => (id ? `<#${id}>` : "—");
    const embed = new EmbedBuilder()
      .setTitle("⚙️ Configuración de BadtzBot")
      .setColor(0x5865f2)
      .addFields(
        { name: "🔊 Voz 24/7", value: ch(c.voice247ChannelId), inline: true },
        { name: "➕ Crear sala", value: ch(c.joinToCreateChannelId), inline: true },
        { name: "🔇 Mudos", value: ch(c.mudosChannelId), inline: true },
        { name: "🔥 Recordatorio", value: ch(c.streakReminderChannelId), inline: true },
        { name: "🏷️ Rol recordatorio", value: c.streakReminderRoleId ? `<@&${c.streakReminderRoleId}>` : "@here", inline: true },
        { name: "🗣️ Voz", value: c.ttsVoice, inline: true },
        { name: "🧠 Modelo IA", value: c.brainModel, inline: true },
        { name: "💬 Conversación", value: `${Math.round(c.conversationWindowMs / 1000)}s`, inline: true },
        { name: "🎚️ Sensibilidad (umbral)", value: `${c.vadThreshold}`, inline: true }
      )
      .setFooter({ text: "Cambia cualquiera con /config <opción>" });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "canal") {
    const key = interaction.options.getString("funcion");
    const canal = interaction.options.getChannel("canal");
    setCfg(gid, key, canal ? canal.id : null);
    return interaction.reply({
      content: canal ? `✅ Asignado: ${canal} para esa función.` : "✅ Función desvinculada.",
      ephemeral: true,
    });
  }

  if (sub === "voz") {
    setCfg(gid, "ttsVoice", interaction.options.getString("voz"));
    return interaction.reply({ content: "✅ Voz actualizada. Pruébala con `/decir hola`.", ephemeral: true });
  }

  if (sub === "modelo") {
    setCfg(gid, "brainModel", interaction.options.getString("modelo"));
    return interaction.reply({ content: "✅ Modelo de IA actualizado.", ephemeral: true });
  }

  if (sub === "sensibilidad") {
    const nivel = interaction.options.getString("nivel");
    const p = SENS[nivel];
    setCfg(gid, "vadThreshold", p.vadThreshold);
    setCfg(gid, "vadMinSpeechMs", p.vadMinSpeechMs);
    return interaction.reply({ content: `✅ Sensibilidad: **${nivel}**.`, ephemeral: true });
  }

  if (sub === "conversacion") {
    const seg = interaction.options.getInteger("segundos");
    setCfg(gid, "conversationWindowMs", seg * 1000);
    return interaction.reply({ content: `✅ Conversación: ${seg}s sin palabra clave.`, ephemeral: true });
  }

  if (sub === "rol-recordatorio") {
    const rol = interaction.options.getRole("rol");
    setCfg(gid, "streakReminderRoleId", rol ? rol.id : null);
    return interaction.reply({ content: rol ? `✅ Recordatorio mencionará a ${rol}.` : "✅ Usará @here.", ephemeral: true });
  }

  if (sub === "reset") {
    resetCfg(gid);
    return interaction.reply({ content: "♻️ Configuración restablecida a los valores por defecto.", ephemeral: true });
  }
}
