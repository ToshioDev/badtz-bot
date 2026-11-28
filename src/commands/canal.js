import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("canal")
  .setDescription("Gestiona canales del servidor")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((s) =>
    s
      .setName("crear-texto")
      .setDescription("Crea un canal de texto")
      .addStringOption((o) => o.setName("nombre").setDescription("Nombre del canal").setRequired(true))
      .addChannelOption((o) =>
        o
          .setName("categoria")
          .setDescription("Categoría donde crearlo")
          .addChannelTypes(ChannelType.GuildCategory)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("crear-voz")
      .setDescription("Crea un canal de voz")
      .addStringOption((o) => o.setName("nombre").setDescription("Nombre del canal").setRequired(true))
      .addChannelOption((o) =>
        o
          .setName("categoria")
          .setDescription("Categoría donde crearlo")
          .addChannelTypes(ChannelType.GuildCategory)
      )
      .addIntegerOption((o) =>
        o.setName("limite").setDescription("Límite de usuarios (0 = sin límite)").setMinValue(0).setMaxValue(99)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("renombrar")
      .setDescription("Renombra un canal")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal a renombrar").setRequired(true))
      .addStringOption((o) => o.setName("nombre").setDescription("Nuevo nombre").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("borrar")
      .setDescription("Borra un canal")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal a borrar").setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (sub === "crear-texto" || sub === "crear-voz") {
    const nombre = interaction.options.getString("nombre");
    const categoria = interaction.options.getChannel("categoria");
    const limite = interaction.options.getInteger("limite") ?? 0;
    const ch = await guild.channels.create({
      name: nombre,
      type: sub === "crear-voz" ? ChannelType.GuildVoice : ChannelType.GuildText,
      parent: categoria?.id ?? null,
      ...(sub === "crear-voz" && limite ? { userLimit: limite } : {}),
    });
    return interaction.reply({ content: `✅ Canal creado: <#${ch.id}>`, ephemeral: true });
  }

  if (sub === "renombrar") {
    const canal = interaction.options.getChannel("canal");
    const nombre = interaction.options.getString("nombre");
    await canal.setName(nombre);
    return interaction.reply({ content: `✅ Renombrado a **${nombre}** (<#${canal.id}>)`, ephemeral: true });
  }

  if (sub === "borrar") {
    const canal = interaction.options.getChannel("canal");
    const nombre = canal.name;
    await canal.delete("Borrado vía /canal borrar");
    return interaction.reply({ content: `🗑️ Canal **${nombre}** borrado.`, ephemeral: true });
  }
}
