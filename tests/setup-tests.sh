#!/bin/sh
export $(grep -v '^#' envs/.env.test | xargs)
[ -f .env ] && mv .env .env.backup
cp envs/.env.test .env

docker-compose -f docker-compose.test.yml -p gs-test up -d

./node_modules/.bin/ts-node tests/create-schema.ts 

./node_modules/.bin/jest --runInBand

rm .env
[ -f .env.backup ] && mv .env.backup .env

docker-compose -p gs-test down
