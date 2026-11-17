# syntax=docker/dockerfile:1
# Web (Next.js standalone) p/ o VPS — usado pelo docker-compose.prod.yml.
# NEXT_PUBLIC_API_URL é embutido no bundle em tempo de build (ARG), porque
# variáveis NEXT_PUBLIC_* são inline no client. Em produção com o Caddy na
# frente, é a ORIGEM PÚBLICA do site (mesma origem do web: /api/* e
# /socket.io/* são roteados p/ a API pelo Caddy — ver Caddyfile).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
