import cron from "node-cron";
import { config } from "../config.js";
import { getCfg } from "../settings.js";
import { recordVoiceActivity, getDoneTodayIds } from "../store.js";

/**
 * Cuenta racha diaria: cada vez que un miembro (no bot) entra a CUALQUIER
 * canal de voz, se le suma el día. Si avanza la racha, lo felicita por DM.
 */
export function setupStreakTracking(client) {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      const member = newState.member;
      if (!member || member.user.bot) return;
      // Solo cuenta cuando ENTRA a voz (antes no estaba en ninguno).
      const joined = !oldState.channelId && newState.channelId;
      if (!joined) return;

      const res = await recordVoiceActivity(member.id, config.tz);
      if (res.changed) {
        const msg =
          res.streak === 1
            ? `🔥 ¡Empezaste tu racha! Día 1. Vuelve mañana a voz para no perderla.`
            : `🔥 ¡Racha de **${res.streak} días**! (récord: ${res.best}). Sigue así.`;
        await member.send(msg).catch(() => {}); // DM puede estar cerrado, no pasa nada
      }
    } catch (err) {
      console.error("[streaks] error:", err.message);
    }
  });
}

/**
 * Recordatorio diario: a la hora configurada hace ping a quienes
 * todavía no han entrado a voz hoy para que no pierdan la racha.
 */
export function setupStreakReminder(client) {
  cron.schedule(
    config.streakReminderCron,
    async () => {
      // Recordatorio en CADA servidor que tenga canal configurado.
      for (const guild of client.guilds.cache.values()) {
        try {
          const channelId = getCfg(guild.id, "streakReminderChannelId");
          if (!channelId) continue;
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (!channel?.isTextBased()) continue;

          const roleId = getCfg(guild.id, "streakReminderRoleId");
          const mention = roleId ? `<@&${roleId}>` : "@here";

          await channel.send(
            `${mention} ⏰ **Recordatorio de racha** 🔥\n` +
              `Entra un momento a un canal de voz para mantener tu racha del día.`
          );
        } catch (err) {
          console.error(`[streaks] recordatorio falló en ${guild.name}:`, err.message);
        }
      }
    },
    { timezone: config.tz }
  );

  console.log(`[streaks] Recordatorio programado (${config.streakReminderCron}, ${config.tz}).`);
}
