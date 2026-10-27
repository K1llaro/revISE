# СТАДИЯ 1: Сборка
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# СТАДИЯ 2: Продакшен
FROM node:22-alpine AS runner
WORKDIR /app

# МАГИЯ AWS LAMBDA: этот адаптер переводит вызовы Serverless в обычные HTTP запросы на порт 4321
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

RUN apk add --no-cache curl
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

# Запускаем твой локальный сервер, который будет обрабатывать Serverless-трафик
CMD ["node", "--import", "tsx", "api/local-server.ts"]