# ==============================================================================
# СТАДИЯ 1: Сборка статики Astro (Builder)
# ==============================================================================
FROM node:22.23.4-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

ENV NODE_ENV=production
RUN npm run build

# ==============================================================================
# СТАДИЯ 2: Продакшен-сервер (Runner)
# ==============================================================================
FROM node:22.23.4-alpine AS runner
WORKDIR /app

# Устанавливаем curl для прохождения Healthcheck
RUN apk add --no-cache curl

# Устанавливаем легчайший и быстрый статический HTTP-сервер
RUN npm install -g serve

ENV PORT=4321
ENV NODE_ENV=production

# Копируем только готовый скомпилированный сайт из стадии билдера
COPY --from=builder /app/dist ./dist

EXPOSE 4321

# Пункт 4 из слайда: встроенный Healthcheck для команды `docker inspect`
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4321/ || exit 1

# Пункт 3 из слайда: запуск сервера на порту 4321
CMD ["serve", "-s", "dist", "-l", "4321"]