#!/bin/sh

echo "Cleaning up orphaned test databases..."

# Clean up MySQL test databases
echo "Cleaning MySQL databases matching gs_test_w%..."
docker exec $(docker ps -qf "name=test-db") mysql -ppassword -e "
  SELECT CONCAT('DROP DATABASE ', SCHEMA_NAME, ';')
  FROM information_schema.SCHEMATA
  WHERE SCHEMA_NAME LIKE 'gs_test_w%'
" | grep DROP | docker exec -i $(docker ps -qf "name=test-db") mysql -ppassword

# Clean up ClickHouse test databases
echo "Cleaning ClickHouse databases matching gs_ch_test_w%..."
docker exec $(docker ps -qf "name=test-clickhouse") clickhouse-client --user gs_ch --password password --query "
  SELECT 'DROP DATABASE ' || name || ';'
  FROM system.databases
  WHERE name LIKE 'gs_ch_test_w%'
  FORMAT TSVRaw
" | docker exec -i $(docker ps -qf "name=test-clickhouse") clickhouse-client --user gs_ch --password password --multiquery

echo "Cleanup complete!"
