#!/bin/sh

export $(grep -e DB_NAME -e DB_PASS .env | xargs)
export DB_HOST=127.0.0.1

trap 'cleanup' EXIT

cleanup() {
  if [ -z "$CI" ]
  then
    cat backup.sql | yarn dc exec -i db /usr/bin/mysql --password=$DB_PASS
    rm -rf backup.sql
  fi
}

set -e

if [ -z "$CI" ]
then
  yarn dc exec db /usr/bin/mysqldump $DB_NAME --password=$DB_PASS > backup.sql
fi

./node_modules/.bin/ts-node tests/refresh-db.ts 
node --trace-warnings ./node_modules/.bin/jest "$@" --runInBand
