export const CreatePlayerSessionsTable = `CREATE TABLE IF NOT EXISTS ${process.env.CLICKHOUSE_DB}.player_sessions (
  id UUID DEFAULT generateUUIDv4(),
  player_id String,
  game_id UInt32,
  dev_build Boolean,
  started_at DateTime64(3),
  ended_at Nullable(DateTime64(3)),
  PRIMARY KEY (id),
  INDEX game_id_idx (game_id) TYPE minmax GRANULARITY 64,
  INDEX player_id_idx (player_id) TYPE minmax GRANULARITY 64
) ENGINE = MergeTree()
ORDER BY (id, started_at, game_id, player_id);`
