# СТАДИЯ 1: Сборка
FROM node:22.23.4-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# СТАДИЯ 2: Продакшен
FROM node:22.23.4-alpine AS runner
WORKDIR /app

# Устанавливаем curl и корневые SSL-сертификаты для безопасного скачивания с GitHub
RUN apk add --no-cache curl ca-certificates

# Скачиваем адаптер через встроенную и надежную команду ADD от Docker
ADD https://github.com/awslabs/aws-lambda-web-adapter/releases/download/v0.8.4/lambda-adapter-x86_64.tar.gz /tmp/adapter.tar.gz
RUN mkdir -p /opt/extensions && tar -xzf /tmp/adapter.tar.gz -C /opt/extensions && rm /tmp/adapter.tar.gz

ENV PORT=4321
ENV NODE_ENV=production

# Копируем всё необходимое для запуска API
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api ./api
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 4321

# Тот самый Healthcheck из требований лектора!
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4321/api/health || exit 1

# Запускаем локальный сервер для обработки Serverless-трафика
CMD ["node", "--import", "tsx", "api/local-server.ts"]