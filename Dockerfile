FROM ghcr.io/pnpm/pnpm:12 AS base
WORKDIR /usr/backend

RUN pnpm runtime set node 26 -g

COPY tsconfig.json .
COPY package.json .
COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml .
EXPOSE 80

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -f -s http://localhost/public/health || exit 1

FROM base AS dev
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
  pnpm install --store-dir /var/cache/pnpm --frozen-lockfile
CMD [ "pnpm", "watch" ]

FROM --platform=$BUILDPLATFORM ghcr.io/pnpm/pnpm:12 AS build
WORKDIR /usr/backend

RUN pnpm runtime set node 26 -g

COPY tsconfig.json tsconfig.build.json package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
  pnpm install --store-dir /var/cache/pnpm --frozen-lockfile
COPY src ./src
RUN pnpm build

FROM base AS prod
ENV NODE_ENV=production
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
  pnpm install --store-dir /var/cache/pnpm --frozen-lockfile --prod
COPY --from=build /usr/backend/dist .
CMD [ "node", "index.js" ]
