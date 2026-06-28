import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { getStreak, getLeaderboard } from "../store.js";

export const data = new SlashCommandBuilder()
  .setName("racha")
  .setDescription("Mira las rachas de voz")
  .addSubcommand((s) =>
    s
      .setName("ver")
      .setDescription("Mira tu racha (o la de alguien)")
      .addUserOption((o) => o.setName("usuario").setDescription("De quién ver la racha"))
  )
  .addSubcommand((s) => s.setName("top").setDescription("Tabla de rachas del servidor"));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "ver") {
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const st = await getStreak(user.id, config.tz);
    const estado = st.active ? "🔥 activa" : "💤 inactiva (entra hoy a voz)";
    const embed = new EmbedBuilder()
      .setTitle(`Racha de ${user.username}`)
      .setColor(st.active ? 0xff6b35 : 0x747f8d)
      .addFields(
        { name: "Racha actual", value: `${st.streak} día(s) — ${estado}`, inline: true },
        { name: "Récord", value: `${st.best || 0} día(s)`, inline: true },
        { name: "Días totales", value: `${st.totalDays || 0}`, inline: true }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "top") {
    const top = await getLeaderboard(10);
    if (!top.length) {
      return interaction.reply("Aún no hay rachas registradas. ¡Entren a voz para empezar! 🔥");
    }
    const medallas = ["🥇", "🥈", "🥉"];
    const lines = top.map(
      (u, i) => `${medallas[i] ?? `**${i + 1}.**`} <@${u.id}> — 🔥 ${u.streak} día(s) (récord ${u.best})`
    );
    const embed = new EmbedBuilder()
      .setTitle("🏆 Top rachas — El servidor de Badtz")
      .setColor(0xffd700)
      .setDescription(lines.join("\n"));
    return interaction.reply({ embeds: [embed] });
  }
}
