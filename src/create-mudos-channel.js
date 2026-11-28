import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import { config, assertConfig } from "./config.js";

assertConfig();
const TEXT_CATEGORY_ID = "1515925370665304084"; // "Canales de texto"
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(config.guildId);
  const existing = (await guild.channels.fetch()).find(
    (c) => c && c.type === ChannelType.GuildText && c.name.includes("mudos")
  );
  if (existing) {
    console.log(`Ya existe: ${existing.id} -> ${existing.name}`);
  } else {
    const ch = await guild.channels.create({
      name: "🔇-mudos",
      type: ChannelType.GuildText,
      parent: TEXT_CATEGORY_ID,
      topic: "Escribe aquí y el bot lo dice en voz alta (para quien no tiene micrófono).",
    });
    console.log(`CREADO: ${ch.id} -> ${ch.name}`);
  }
  client.destroy();
  process.exit(0);
});

client.login(config.token);
