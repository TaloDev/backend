export const CreatePlayerGameStatSnapshotsTable = `CREATE TABLE IF NOT EXISTS ${process.env.CLICKHOUSE_DB}.player_game_stat_snapshots (
  id UUID DEFAULT generateUUIDv4(),
  player_alias_id UInt32,
  game_stat_id UInt32,
  change Float64,
  value Float64,
  global_value Float64,
  created_at DateTime64(3),
  PRIMARY KEY (id),
  INDEX player_alias_id_idx (player_alias_id) TYPE minmax GRANULARITY 64,
  INDEX game_stat_id_idx (game_stat_id) TYPE minmax GRANULARITY 64
) ENGINE = MergeTree()
ORDER BY (id, created_at, player_alias_id, game_stat_id);`
