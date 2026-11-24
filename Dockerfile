FROM node:22-alpine

ENV NODE_ENV=production \
    DATA_FILE=/app/data/stats.json

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
