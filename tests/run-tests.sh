#!/bin/sh

export $(cat envs/.env.test | xargs)

if [ -z "$CI" ]; then
  alias dc="docker compose -f docker-compose.test.yml"
else
  alias dc="docker compose -f docker-compose.test.yml -f docker-compose.ci.yml"
fi

trap "cleanup" EXIT

cleanup() {
  if [ -z "$CI" ]
  then
    dc down -v
  fi
}

set -e

dc up -d

bunx mikro-orm migration:up
bun ./tests/migrateClickHouse.ts
echo "\n"

if [ -z "$EXPOSE_GC" ]
then
  node --trace-warnings ./node_modules/.bin/vitest "$@"
else
  node --expose-gc --trace-warnings ./node_modules/.bin/vitest "$@" --logHeapUsage
fi
