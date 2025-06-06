export const CreateSocketEventsTable = `CREATE TABLE IF NOT EXISTS ${process.env.CLICKHOUSE_DB}.socket_events (
  id UUID DEFAULT generateUUIDv4(),
  event_type String,
  req_or_res Enum('req' = 0, 'res' = 1),
  code Nullable(String),
  game_id UInt32,
  player_alias_id Nullable(UInt32),
  dev_build Boolean,
  created_at DateTime64(3),
  PRIMARY KEY (id),
  INDEX game_id_idx (game_id) TYPE minmax GRANULARITY 64,
  INDEX player_alias_id_idx (player_alias_id) TYPE minmax GRANULARITY 64
) ENGINE = MergeTree()
ORDER BY (id, created_at, game_id);`
