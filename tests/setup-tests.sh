#!/bin/sh
mv .env .env.backup
cp envs/.env.test .env

docker-compose -f docker-compose.test.yml -p gs-test up -d

env TS_NODE_COMPILER_OPTIONS='{"module": "commonjs" }' mocha -r ts-node/register 'tests/**/*.ts'

rm .env
mv .env.backup .env

docker-compose -p gs-test down
