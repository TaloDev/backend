FROM node:24 AS base
WORKDIR /usr/backend
COPY tsconfig.json .
COPY package.json .
COPY package-lock.json .
EXPOSE 80
HEALTHCHECK --start-period=60s \
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
RUN npm ci
COPY --from=build /usr/backend/dist .
CMD [ "node", "index.js" ]
