FROM node:lts-alpine AS base
WORKDIR /usr/backend
COPY tsconfig.json .
COPY package.json .
COPY yarn.lock .

FROM base AS dev
COPY .env .
RUN yarn
EXPOSE 3000
CMD [ "yarn", "start" ]

FROM base AS build
COPY tsconfig.build.json .
RUN yarn
COPY src ./src
RUN yarn build

FROM base AS prod
ENV NODE_ENV production
RUN yarn
COPY --from=build /usr/backend/dist .
