import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

// Mapa de "acción" legible -> permisos de Discord.
const PERMS = {
  ver: [PermissionFlagsBits.ViewChannel],
  escribir: [PermissionFlagsBits.SendMessages],
  conectar: [PermissionFlagsBits.Connect],
  hablar: [PermissionFlagsBits.Speak],
};

export const data = new SlashCommandBuilder()
  .setName("permiso")
  .setDescription("Gestiona permisos de canales por rol o usuario")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand((s) =>
    s
      .setName("dar")
      .setDescription("Permite una acción a un rol/usuario en un canal")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal").setRequired(true))
      .addStringOption((o) =>
        o
          .setName("accion")
          .setDescription("Qué permitir")
          .setRequired(true)
          .addChoices(
            { name: "Ver canal", value: "ver" },
            { name: "Escribir", value: "escribir" },
            { name: "Conectar a voz", value: "conectar" },
            { name: "Hablar en voz", value: "hablar" }
          )
      )
      .addRoleOption((o) => o.setName("rol").setDescription("Rol objetivo"))
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo"))
  )
  .addSubcommand((s) =>
    s
      .setName("quitar")
      .setDescription("Niega una acción a un rol/usuario en un canal")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal").setRequired(true))
      .addStringOption((o) =>
        o
          .setName("accion")
          .setDescription("Qué negar")
          .setRequired(true)
          .addChoices(
            { name: "Ver canal", value: "ver" },
            { name: "Escribir", value: "escribir" },
            { name: "Conectar a voz", value: "conectar" },
            { name: "Hablar en voz", value: "hablar" }
          )
      )
      .addRoleOption((o) => o.setName("rol").setDescription("Rol objetivo"))
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario objetivo"))
  )
  .addSubcommand((s) =>
    s
      .setName("privado")
      .setDescription("Hace un canal privado (solo un rol puede verlo)")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal").setRequired(true))
      .addRoleOption((o) => o.setName("rol").setDescription("Rol con acceso").setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const canal = interaction.options.getChannel("canal");

  if (sub === "privado") {
    const rol = interaction.options.getRole("rol");
    const everyone = interaction.guild.roles.everyone;
    await canal.permissionOverwrites.edit(everyone, { ViewChannel: false });
    await canal.permissionOverwrites.edit(rol, { ViewChannel: true });
    return interaction.reply({
      content: `🔒 <#${canal.id}> ahora es privado. Solo **${rol.name}** puede verlo.`,
      ephemeral: true,
    });
  }

  const rol = interaction.options.getRole("rol");
  const usuario = interaction.options.getUser("usuario");
  const target = rol ?? usuario;
  if (!target) {
    return interaction.reply({ content: "⚠️ Indica un **rol** o un **usuario**.", ephemeral: true });
  }

  const accion = interaction.options.getString("accion");
  const allow = sub === "dar";
  const overwrite = {};
  for (const flag of PERMS[accion]) {
    // Usa el nombre del flag como clave (edit acepta nombres de PermissionFlagsBits).
    const key = Object.keys(PermissionFlagsBits).find((k) => PermissionFlagsBits[k] === flag);
    overwrite[key] = allow;
  }

  await canal.permissionOverwrites.edit(target.id, overwrite);
  const verbo = allow ? "permitido" : "negado";
  const quien = rol ? `rol **${rol.name}**` : `usuario **${usuario.username}**`;
  return interaction.reply({
    content: `✅ **${accion}** ${verbo} al ${quien} en <#${canal.id}>.`,
    ephemeral: true,
  });
}
