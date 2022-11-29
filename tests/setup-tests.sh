#!/bin/sh

export $(cat envs/.env.test | xargs)

alias dc="docker-compose -f docker-compose.test.yml"

trap "cleanup" EXIT

cleanup() {
  if [ -z "$CI" ]
  then
    dc down -v
  fi
}

set -e

dc up -d

yarn mikro-orm migration:up
echo "\n"

node --expose-gc --trace-warnings ./node_modules/.bin/jest "$@" --runInBand --logHeapUsage
