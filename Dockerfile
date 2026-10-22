FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instala ferramentas essenciais e build-essential para compilação nativa estável do better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ dumb-init && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY tsconfig.json ./

# Instala e compila dependências diretamente no ambiente de execução final
RUN npm install

COPY src/ ./src/
COPY public/ ./public/

# Compila o TypeScript
RUN npm run build

# Cria diretório padrão para persistência do banco SQLite
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/workouts.db

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
