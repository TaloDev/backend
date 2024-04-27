FROM node:lts AS base
WORKDIR /usr/backend
COPY tsconfig.json .
COPY package.json .
COPY package-lock.json .
EXPOSE 80

FROM base AS dev
RUN npm install
CMD [ "npm", "run", "watch" ]

FROM base AS build
COPY tsconfig.build.json .
RUN npm install
COPY src ./src
RUN npm run build

FROM base AS prod
ENV NODE_ENV production
RUN npm install
COPY --from=build /usr/backend/dist .
CMD [ "node", "index.js" ]
