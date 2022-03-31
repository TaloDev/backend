#!/bin/sh

export $(cat envs/.env.test | xargs)

CONTAINER=test-db

trap "cleanup" EXIT

cleanup() {
  if [ -z "$CI" ]
  then
    docker rm --force $CONTAINER -v
  fi
}

set -e

docker run --name $CONTAINER -e MYSQL_DATABASE=$DB_NAME -e MYSQL_ROOT_PASSWORD=$DB_PASS -p $DB_PORT:3306 -d mysql:8

echo "\nWaiting for database..."

TIME_TAKEN=0
while ! docker exec $CONTAINER mysql --password=$DB_PASS --port=$DB_PORT -e "SELECT 1" >/dev/null 2>&1; do
  TIME_TAKEN=$(( TIME_TAKEN + 1 ))
  sleep 1
done

echo "Database took $TIME_TAKEN seconds to get ready\n"

sleep 1

yarn mikro-orm migration:up

echo "\n"

node --trace-warnings ./node_modules/.bin/jest "$@" --runInBand
