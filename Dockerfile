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

# Устанавливаем curl (он нужен и для скачивания адаптера, и для Healthcheck)
RUN apk add --no-cache curl

# МАГИЯ AWS LAMBDA (Без лимитов AWS ECR):
# Скачиваем бинарник адаптера напрямую с GitHub и кладем в папку расширений Lambda
RUN mkdir -p /opt/extensions && \
    curl -sSL https://github.com/awslabs/aws-lambda-web-adapter/releases/download/v0.8.4/lambda-adapter-x86_64.tar.gz | tar -xz -C /opt/extensions

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