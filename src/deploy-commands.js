import { REST, Routes } from "discord.js";
import { config, assertConfig } from "./config.js";
import { commandsJSON } from "./commands/index.js";

// SaaS: registra comandos GLOBALES (sirven en todos los servidores).
// Para pruebas instantáneas en tu servidor, corre con DEPLOY_GUILD=1 (usa GUILD_ID).
async function main() {
  assertConfig();
  const rest = new REST({ version: "10" }).setToken(config.token);
  const devGuild = process.env.DEPLOY_GUILD === "1" && config.guildId;

  if (devGuild) {
    const data = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commandsJSON }
    );
    console.log(`✅ ${data.length} comandos registrados en el servidor ${config.guildId} (modo dev, instantáneo).`);
  } else {
    const data = await rest.put(Routes.applicationCommands(config.clientId), { body: commandsJSON });
    console.log(`✅ ${data.length} comandos GLOBALES registrados (pueden tardar ~1h en propagarse).`);
    // Limpia los comandos del servidor de dev para evitar duplicados.
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] }).catch(() => {});
    }
  }
}

main().catch((err) => {
  console.error("❌ Error registrando comandos:", err);
  process.exit(1);
});
