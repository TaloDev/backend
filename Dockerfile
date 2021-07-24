FROM node:lts-alpine AS base

ENV SERVER_PORT=9000

WORKDIR /usr/backend
COPY tsconfig.json .
COPY package.json .
COPY yarn.lock .

FROM base AS dev
RUN yarn
EXPOSE $SERVER_PORT
CMD [ "yarn", "watch" ]

FROM base AS build
COPY tsconfig.build.json .
RUN yarn
COPY src ./src
RUN yarn build

FROM base AS prod
ENV NODE_ENV production
RUN yarn
COPY --from=build /usr/backend/dist .
CMD [ "node", "index.js" ]
