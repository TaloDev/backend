#!/bin/sh
export $(grep -v '^#' envs/.env.test | xargs)
mv .env .env.backup
cp envs/.env.test .env

docker-compose -f docker-compose.test.yml -p gs-test up -d

echo 'Waiting for DB to be ready...'

sleep 20

yarn schema:create

./node_modules/.bin/jest

rm .env
mv .env.backup .env

docker-compose -p gs-test down
