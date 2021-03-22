#!/bin/sh
[ -f .env ] && mv .env .env.backup
cp envs/.env.test .env

./node_modules/.bin/ts-node tests/create-schema.ts 
./node_modules/.bin/jest "$@"

rm .env
[ -f .env.backup ] && mv .env.backup .env
