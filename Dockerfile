FROM node:24 AS base
WORKDIR /usr/backend
COPY package.json .
COPY bun.lock .
EXPOSE 80
HEALTHCHECK --start-period=60s \
  CMD curl -f -s http://localhost/public/health || exit 1

FROM base AS dev
RUN bun install --frozen-lockfile
CMD [ "bun", "run", "watch" ]

FROM base AS prod
ENV NODE_ENV=production
RUN bun install --frozen-lockfile
COPY src ./src
RUN bun run build
CMD [ "bun", "run", "dist/index.js" ]
