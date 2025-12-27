FROM node:24-slim AS base
WORKDIR /usr/backend

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY tsconfig.json .
COPY package.json .
COPY package-lock.json .
EXPOSE 80

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -f -s http://localhost/public/health || exit 1

FROM base AS dev
RUN npm ci
CMD [ "npm", "run", "watch" ]

FROM base AS build
COPY tsconfig.build.json .
RUN npm ci
COPY src ./src
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=build /usr/backend/dist .
CMD [ "node", "index.js" ]
