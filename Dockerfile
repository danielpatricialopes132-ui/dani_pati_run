# Stage 1: Build & Dependencies
FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependências para compilar better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Compila o TypeScript para JavaScript em /app/dist
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Ferramenta para gerenciar sinais de processo (SIGINT/SIGTERM)
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Copia os node_modules já compilados pelo builder (evita recompilar better-sqlite3)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Diretório para persistência do banco SQLite
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/workouts.db

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
