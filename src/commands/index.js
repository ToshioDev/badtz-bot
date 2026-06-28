import * as canal from "./canal.js";
import * as permiso from "./permiso.js";
import * as racha from "./racha.js";
import * as voz247 from "./voz247.js";
import * as setup from "./setup.js";
import * as asistente from "./asistente.js";
import * as decir from "./decir.js";
import * as configCmd from "./config.js";

export const commandModules = [canal, permiso, racha, voz247, setup, asistente, decir, configCmd];

/** Map nombre -> módulo, para el handler de interacciones. */
export const commands = new Map(commandModules.map((m) => [m.data.name, m]));

/** Array de JSON para registrar en la API de Discord. */
export const commandsJSON = commandModules.map((m) => m.data.toJSON());
