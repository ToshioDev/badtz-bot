import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import { config, assertConfig } from "./config.js";

assertConfig();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();

  const tipo = (c) =>
    c.type === ChannelType.GuildText
      ? "TEXTO"
      : c.type === ChannelType.GuildVoice
        ? "VOZ  "
        : c.type === ChannelType.GuildCategory
          ? "CATEG"
          : "OTRO ";

  console.log(`\n📋 Canales de "${guild.name}":\n`);
  [...channels.values()]
    .filter(Boolean)
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
    .forEach((c) => console.log(`  [${tipo(c)}]  ${c.id}  →  ${c.name}`));

  console.log("");
  client.destroy();
  process.exit(0);
});

client.login(config.token);
