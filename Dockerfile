FROM node:lts-alpine AS base
WORKDIR /usr/app
COPY package.json .
COPY yarn.lock .
COPY tsconfig.json .

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
# temp
COPY .env .
RUN yarn
COPY --from=build /usr/app/dist .
# RUN npm install pm2 -g
# EXPOSE 80
# CMD [ "pm2-runtime", "index.js" ]
CMD [ "node", "index.js" ]