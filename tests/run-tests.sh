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

# temp dir stores entity data
rm -rf temp

# pnpm forwards the `--` separator as a literal arg; vitest treats it as a
# positional filter and ignores every option after it, so drop it
[ "$1" = "--" ] && shift

set -e

dc up -d
tsx ./tests/migrateTestDatabases.ts &
wait

echo "\n"

if [ -z "$EXPOSE_GC" ]
then
  ./node_modules/.bin/vitest "$@"
else
  NODE_OPTIONS=--expose-gc ./node_modules/.bin/vitest "$@" --logHeapUsage
fi
