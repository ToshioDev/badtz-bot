FROM node:24-slim

# Sin dependencias nativas: opus por opusscript (JS), sodium por wasm, ffmpeg por ffmpeg-static.
WORKDIR /app

# Deps de producción del bot (incluye build de @discordjs/opus y descarga de ffmpeg-static).
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Código + compilación del panel web (React/Vite -> src/web/public).
COPY . .
RUN cd dashboard && npm install && npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Registra comandos globales (no bloqueante) y arranca el bot + panel.
CMD ["sh", "-c", "node src/deploy-commands.js; node src/index.js"]
