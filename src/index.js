import { Client, GatewayIntentBits, Events, ActivityType } from "discord.js";
import { config, assertConfig } from "./config.js";
import { commands } from "./commands/index.js";
import { connectVoice } from "./features/voice247.js";
import { setupTempRooms } from "./features/tempRooms.js";
import { setupStreakTracking, setupStreakReminder } from "./features/streaks.js";
import { speakText } from "./features/voiceAI.js";
import { getCfg } from "./settings.js";
import { startWebServer } from "./web/server.js";

assertConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // necesario para leer el texto del canal #mudos
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Conectado como ${c.user.tag}`);
  c.user.setActivity("las rachas 🔥", { type: ActivityType.Watching });

  // Features que dependen del guild.
  setupTempRooms(client);
  setupStreakTracking(client);
  setupStreakReminder(client);
  startWebServer(client); // panel web de configuración

  // Voz 24/7 al arrancar: en CADA servidor que lo tenga configurado.
  for (const guild of client.guilds.cache.values()) {
    const voice247 = getCfg(guild.id, "voice247ChannelId");
    if (!voice247) continue;
    try {
      connectVoice(guild, voice247);
      console.log(`🔊 Voz 24/7 activa en ${guild.name}.`);
    } catch (e) {
      console.error(`Voz 24/7 falló en ${guild.name}:`, e.message);
    }
  }

  console.log(`🌐 En ${client.guilds.cache.size} servidor(es).`);
});

// Al unirse a un servidor nuevo (SaaS): saluda en un canal y deja instrucciones.
client.on(Events.GuildCreate, async (guild) => {
  console.log(`➕ Añadido a: ${guild.name} (${guild.id})`);
  const channel = guild.systemChannel ||
    guild.channels.cache.find((c) => c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has("SendMessages"));
  if (channel) {
    await channel
      .send(
        "👋 ¡Hola! Soy **BadtzBot**. Un admin puede configurarme con `/setup` y `/config`, " +
          "o desde el panel web. Para la voz con IA, pongan sus API keys de Claude y Groq en el panel."
      )
      .catch(() => {});
  }
});

// Handler de comandos slash.
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error en /${interaction.commandName}:`, err);
    const payload = { content: "❌ Algo falló ejecutando el comando.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

// Canal #mudos: quien no tenga micrófono escribe aquí y el bot lo dice en voz.
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot) return;
  const mudosId = getCfg(message.guild.id, "mudosChannelId");
  if (!mudosId || message.channelId !== mudosId) return;

  const text = message.content?.trim();
  if (!text) return; // (si llega vacío, falta activar "Message Content Intent")
  if (text.length > 400) {
    await message.reply("⚠️ Muy largo para leer en voz (máx. 400 caracteres).").catch(() => {});
    return;
  }

  const ok = speakText(message.guild, text);
  if (ok) {
    await message.react("🗣️").catch(() => {});
  } else {
    await message
      .reply("🔇 No estoy en un canal de voz. Que alguien me meta con `/asistente entrar` o `/voz247 entrar`.")
      .catch(() => {});
  }
});

client.on("error", (e) => console.error("Client error:", e));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

client.login(config.token);
