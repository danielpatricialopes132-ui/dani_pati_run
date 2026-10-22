FROM node:20-bookworm-slim

WORKDIR /app

ENV PORT=3000

# Pacotes essenciais para compilação nativa C++ do better-sqlite3 e init process
RUN apt-get update && apt-get install -y python3 make g++ dumb-init && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY tsconfig.json ./

# Instala todas as dependências (incluindo devDependencies como typescript/tsc)
ENV NODE_ENV=development
RUN npm install

COPY src/ ./src/
COPY public/ ./public/

# Compila o TypeScript usando tsc
RUN npm run build

# Remove dependências de desenvolvimento após a compilação
ENV NODE_ENV=production
RUN npm prune --production

# Diretório padrão para persistência do banco SQLite
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/workouts.db

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
