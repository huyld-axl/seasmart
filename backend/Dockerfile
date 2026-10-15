# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

# LibreOffice is required for Excel -> PDF exports; fonts keep Vietnamese text readable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu libreoffice-calc fonts-dejavu fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app/backend
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY migrations/postgres ./migrations/postgres
COPY docker-entrypoint.sh /usr/local/bin/seasmart-entrypoint
RUN chmod 755 /usr/local/bin/seasmart-entrypoint
RUN mkdir -p uploads /app/forms && chown node:node /app /app/backend uploads /app/forms
EXPOSE 3000
ENTRYPOINT ["seasmart-entrypoint"]
CMD ["node", "server.js"]
