#!/bin/sh
mv ../.env ../.env.backup
cp ../envs/.env.test ../.env
env TS_NODE_COMPILER_OPTIONS='{\"module\": \"commonjs\" }' mocha -r ts-node/register 'tests/**/*.ts'
rm ../.env
mv ../.env.backup ../.env
