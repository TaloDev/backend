#!/bin/bash
set -e

INIT_DIR="/docker-entrypoint-initdb.d"
FLAG_FILE="$INIT_DIR/.migrated"

if [ ! -f "$FLAG_FILE" ]; then
  for file in ${INIT_DIR}/*.sql; do
    if [ -f "$file" ]; then
      envsubst < "$file" > "$file.processed" && mv "$file.processed" "$file"
      echo "Processed migration $file"
    fi
  done

  echo "Creating migrations lock"
  touch "$FLAG_FILE"
else
  echo "Migrations lock set; Skipping envsubst processing"
fi

exec /entrypoint.sh "$@"
