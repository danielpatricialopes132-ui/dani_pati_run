FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY tsconfig.json ./

# Instala todas as dependências para compilar TypeScript
RUN npm install --include=dev

COPY src/ ./src/
COPY public/ ./public/

# Compila o TypeScript para dist/
RUN npm run build

# Remove as devDependencies (cria imagem extremamente leve)
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/index.js"]
