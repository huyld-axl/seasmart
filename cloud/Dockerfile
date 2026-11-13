# syntax=docker/dockerfile:1
# Máy chủ dịch vụ MCAH (cloud/). Dựng từ thư mục gốc repo (compose: context ., dockerfile cloud/Dockerfile) vì máy chủ
# dùng lại module AI / tra tàu / danh mục của backend/src. .dockerignore ở gốc chỉ cho vào đúng các phần cần.
FROM node:24-bookworm-slim
ENV NODE_ENV=production

# Thư viện của backend mà các module dùng lại cần (openai, @anthropic-ai/sdk…). Bỏ script cài: không cần module biên dịch.
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY backend/src ./src

WORKDIR /app/cloud
COPY cloud/package.json cloud/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY cloud/server.js ./
COPY cloud/src ./src
COPY cloud/scripts ./scripts
COPY cloud/migrations ./migrations
# .data giữ khoá ký vé (volume cloud_data): mất khoá là mọi app đã cài không đăng nhập được, phải sao lưu.
RUN mkdir -p .data && chown -R node:node /app/cloud/.data
USER node
EXPOSE 4100
CMD ["sh", "-c", "node scripts/migrate.js && exec node server.js"]
