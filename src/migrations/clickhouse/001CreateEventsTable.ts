export const CreateEventsTable = `CREATE TABLE IF NOT EXISTS ${process.env.CLICKHOUSE_DB}.events (
  id String,
  name String,
  game_id UInt32,
  player_alias_id UInt32,
  dev_build Boolean,
  created_at DateTime,
  updated_at DateTime,
  PRIMARY KEY (id),
  INDEX game_id_idx (game_id) TYPE minmax GRANULARITY 64,
  INDEX player_alias_id_idx (player_alias_id) TYPE minmax GRANULARITY 64
) ENGINE = MergeTree()
ORDER BY (id, created_at, game_id, player_alias_id);`
