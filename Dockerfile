FROM node:24 AS base
WORKDIR /usr/backend
COPY package.json .
COPY bun.lock .
EXPOSE 80
HEALTHCHECK --start-period=60s \
  CMD curl -f -s http://localhost/public/health || exit 1

FROM base AS dev
RUN bun ci
CMD [ "bun", "run", "watch" ]

FROM base AS prod
ENV NODE_ENV=production
RUN bun ci
COPY src .
CMD [ "bun", "index.ts" ]
