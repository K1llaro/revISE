# ==============================================================================
# СТАДИЯ 1: Сборка зависимостей и бандлинг API (Builder)
# Используем образ Lambda, чтобы npm установил нативные бинарники glibc (@libsql/linux-x64-gnu)
# ==============================================================================
FROM public.ecr.aws/lambda/nodejs:22 AS builder
WORKDIR /app

COPY package*.json ./
# Устанавливаем все зависимости, включая нативный драйвер Turso для Linux
RUN npm ci

COPY . .

# Собираем api/handler.ts, оставляя нативные библиотеки в node_modules
RUN npx --yes esbuild api/handler.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile=dist-api/index.js \
  --external:@aws-sdk/* \
  --external:@libsql/*

# Удаляем тяжелые dev-зависимости (Astro, TypeScript и т.д.), оставляя только runtime
RUN npm prune --omit=dev

# ==============================================================================
# СТАДИЯ 2: Финальный образ AWS Lambda (Runner)
# ==============================================================================
FROM public.ecr.aws/lambda/nodejs:22
WORKDIR ${LAMBDA_TASK_ROOT}

# Копируем продакшен node_modules с нативным драйвером @libsql/linux-x64-gnu
COPY --from=builder /app/node_modules ./node_modules
# Копируем скомпилированный бандл
COPY --from=builder /app/dist-api/index.js ./index.js

CMD [ "index.handler" ]