FROM node:lts-alpine as base
WORKDIR /usr/app
COPY package.json .
COPY yarn.lock .
COPY src ./src

FROM base as dev
COPY tsconfig.json .
COPY .env .
RUN yarn
CMD [ "yarn", "start" ]

FROM base as build
COPY tsconfig.build.json .
RUN yarn
RUN yarn build

FROM base as prod
ENV NODE_ENV production
RUN yarn
COPY --from=build /dist .
RUN npm install pm2 -g
EXPOSE 80
CMD [ "pm2-runtime", "index.js" ]
