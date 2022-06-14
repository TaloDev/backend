#!/bin/sh

export $(cat envs/.env.test | xargs)

DB_CONTAINER=test-db
STRIPE_CONTAINER=stripe-api

trap "cleanup" EXIT

cleanup() {
  if [ -z "$CI" ]
  then
    docker rm --force -v $DB_CONTAINER $STRIPE_CONTAINER
  fi
}

set -e

docker run --name $DB_CONTAINER -e MYSQL_DATABASE=$DB_NAME -e MYSQL_ROOT_PASSWORD=$DB_PASS -p $DB_PORT:3306 -d mysql:8
docker run --name $STRIPE_CONTAINER -p 12111-12112:12111-12112 -d stripe/stripe-mock:latest

echo "\nWaiting for database..."

TIME_TAKEN=0
while ! docker exec $DB_CONTAINER mysql --password=$DB_PASS --port=$DB_PORT -e "SELECT 1" >/dev/null 2>&1; do
  TIME_TAKEN=$(( TIME_TAKEN + 1 ))
  sleep 1
done

echo "Database took $TIME_TAKEN seconds to get ready\n"
sleep 1

yarn mikro-orm migration:up
echo "\n"

node --trace-warnings ./node_modules/.bin/jest "$@" --runInBand
