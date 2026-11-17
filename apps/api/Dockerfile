# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json ./
# monorepo: em build isolado da API, instala só deps da API (lockfile completo entra no Step 2/CI)
RUN npm install --omit=dev=false
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER app
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3333/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
