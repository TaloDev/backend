#!/bin/sh

trap 'cleanup' EXIT

cleanup() {
  if [ -z "$CI" ]
  then
    rm .env
    [ -f .env.backup ] && mv .env.backup .env
  fi
}

set -e

[ -f .env ] && mv .env .env.backup
cp envs/.env.test .env

./node_modules/.bin/ts-node tests/refresh-test-db.ts 
./node_modules/.bin/jest "$@" --runInBand
