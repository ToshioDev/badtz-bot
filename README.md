# Badtz Bot 🤖🔥

Bot de Discord para **El servidor de Badtz**. Gestiona canales, permisos, mantiene una sala de voz abierta 24/7 y lleva un sistema de **rachas** de voz con recordatorios.

## Qué hace

| Función | Cómo |
|---|---|
| **Voz 24/7** (mantener sala abierta) | El bot se queda conectado a un canal de voz. Auto al arrancar (`VOICE_24_7_CHANNEL_ID`) o con `/voz247 entrar`. |
| **Contador de racha diaria** | Cada día que entras a voz suma a tu racha. Te felicita por DM. `/racha ver`, `/racha top`. |
| **Salas temporales** (join-to-create) | Al entrar al canal `➕ Crear sala`, el bot te crea tu propia sala y la borra al quedar vacía. |
| **Recordatorio de racha** | Mensaje diario a la hora configurada para que nadie pierda su racha. |
| **Gestión de canales** | `/canal crear-texto`, `/canal crear-voz`, `/canal renombrar`, `/canal borrar`, `/setup`. |
| **Gestión de permisos** | `/permiso dar`, `/permiso quitar`, `/permiso privado` (por rol o usuario). |
| **🎙️ Asistente de voz con IA** | Di **"Badtz, ..."** en voz y el bot escucha, piensa con Claude y responde por voz. `/asistente entrar`. |

## 🎙️ Asistente de voz con IA (gratis)

El bot puede escucharte en voz y responderte hablando. Cadena: **Groq Whisper** (transcribe, gratis) → **Claude** (responde) → **edge-tts** (voz, gratis).

Costo real: solo los tokens de Claude (~1 centavo por respuesta). Groq y edge-tts son gratis.

### Configurar
1. `ANTHROPIC_API_KEY` — tu key de Claude (console.anthropic.com)
2. `GROQ_API_KEY` — **gratis** en console.groq.com (sin tarjeta) → API Keys → Create
3. (opcional) `BRAIN_MODEL` — `claude-haiku-4-5` (rápido, por defecto), `claude-sonnet-4-6` o `claude-opus-4-8`
4. (opcional) `TTS_VOICE` — `es-MX-JorgeNeural` (por defecto), `es-MX-DaliaNeural`, etc.

### Usar
- `/asistente entrar` — el bot entra a tu canal de voz y empieza a escuchar
- Di **"Badtz, cuéntame un chiste"** (o lo que sea) → te responde por voz
- `/asistente olvidar` — borra la memoria de la charla
- `/asistente salir` — deja de escuchar

## 1. Crear la aplicación/bot en Discord

1. Entra a https://discord.com/developers/applications → **New Application**.
2. Pestaña **Bot** → **Reset Token** → copia el token → va en `DISCORD_TOKEN`.
3. En **Bot**, activa los **Privileged Gateway Intents**:
   - ✅ **Server Members Intent**
   - ✅ (no necesitas Message Content para este bot)
4. **General Information** → copia el **Application ID** → va en `CLIENT_ID`.
5. Invita el bot con este link (reemplaza `CLIENT_ID`):
   ```
   https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
   ```
   (`permissions=8` = Administrador, lo más simple. Puedes restringir luego.)

## 2. Configurar

```bash
cp .env.example .env
# edita .env con tu token, CLIENT_ID y GUILD_ID
```

Para sacar IDs: activa **Ajustes → Avanzado → Modo desarrollador**, luego clic derecho → *Copiar ID* sobre el servidor o canales.

## 3. Correr local (prueba)

```bash
npm install
npm run deploy   # registra los comandos slash (una vez, o cuando los cambies)
npm start
```

## 4. Desplegar en Railway (siempre encendido)

1. Sube esta carpeta a un repo de GitHub.
2. En https://railway.app → **New Project → Deploy from GitHub repo**.
3. En **Variables**, agrega las mismas de `.env` (`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, y las opcionales).
4. Railway usa `railway.json` → arranca con `node src/index.js`.
5. Registra los comandos una vez: en Railway abre una shell (o corre local) `npm run deploy`.

> **Nota:** este es un **worker** (no expone web), así que no necesita puerto. En Railway funciona igual; si te pide healthcheck, déjalo vacío.

### Persistencia de rachas en Railway
El archivo `data/streaks.json` se borra en cada deploy si no usas un **Volume**. Para conservar rachas, en Railway crea un *Volume* montado en `/app/data`. (Para empezar puedes dejarlo así y migrar a una DB después.)

## Comandos

- `/setup` — crea la estructura base de canales que falte.
- `/canal crear-texto | crear-voz | renombrar | borrar`
- `/permiso dar | quitar | privado`
- `/voz247 entrar | salir | estado`
- `/racha ver | top`
