# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG FRONTEND_BUILD_ID=manual
ARG FRONTEND_API_URL=/api/v1
# Keep the env file out of image layers and build arguments. Disable local demo
# credentials in deployment bundles; the existing local .env remains untouched.
RUN --mount=type=secret,id=frontend_env,target=/app/.env,required=true \
    test -n "$FRONTEND_BUILD_ID" \
    && VITE_API_URL="$FRONTEND_API_URL" VITE_LOCAL_DEMO_EMAIL= VITE_LOCAL_DEMO_PASSWORD= npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
