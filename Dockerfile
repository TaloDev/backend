FROM ghcr.io/pnpm/pnpm:12.0.0 AS base
WORKDIR /usr/backend

RUN pnpm runtime set node 24 -g

COPY tsconfig.json .
COPY package.json .
COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml .
EXPOSE 80

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -f -s http://localhost/public/health || exit 1

FROM base AS dev
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
CMD [ "pnpm", "watch" ]

FROM base AS build
COPY tsconfig.build.json .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm build

FROM base AS prod
ENV NODE_ENV=production
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
COPY --from=build /usr/backend/dist .
CMD [ "node", "index.js" ]
