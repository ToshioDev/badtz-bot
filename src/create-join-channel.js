import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import { config, assertConfig } from "./config.js";

assertConfig();
const VOICE_CATEGORY_ID = "1515925370665304088"; // "Canales de voz"
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(config.guildId);
  const existing = (await guild.channels.fetch()).find(
    (c) => c && c.type === ChannelType.GuildVoice && c.name.includes("Crear sala")
  );
  if (existing) {
    console.log(`Ya existe: ${existing.id} → ${existing.name}`);
  } else {
    const ch = await guild.channels.create({
      name: "➕ Crear sala",
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY_ID,
    });
    console.log(`CREADO: ${ch.id} → ${ch.name}`);
  }
  client.destroy();
  process.exit(0);
});

client.login(config.token);
