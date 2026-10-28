# ==============================================================================
# СТАДИЯ 1: Сборка и бандлинг TypeScript API в один JS-файл (Builder)
# ==============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Собираем api/handler.ts в один легковесный файл dist-api/index.js
# @aws-sdk оставляем внешним, так как он уже встроен в AWS Lambda
RUN npx --yes esbuild api/handler.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile=dist-api/index.js \
  --external:@aws-sdk/*

# ==============================================================================
# СТАДИЯ 2: Официальная среда выполнения AWS Lambda (Runner)
# ==============================================================================
FROM public.ecr.aws/lambda/nodejs:22
WORKDIR ${LAMBDA_TASK_ROOT}

# Копируем готовый скомпилированный код бэкенда
COPY --from=builder /app/dist-api/index.js ./index.js

# Указываем Lambda точку входа: файл index.js, экспортированная функция handler
CMD [ "index.handler" ]