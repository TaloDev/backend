export const MigrateEventsTimestampsToDate64 = `
  CREATE TABLE ${process.env.CLICKHOUSE_DB}.events_new
  (
    id String,
    name String,
    game_id UInt32,
    player_alias_id UInt32,
    dev_build Boolean,
    created_at DateTime64(3),
    updated_at DateTime64(3),
    PRIMARY KEY (id),
    INDEX game_id_idx (game_id) TYPE minmax GRANULARITY 64,
    INDEX player_alias_id_idx (player_alias_id) TYPE minmax GRANULARITY 64
  ) ENGINE = MergeTree()
  ORDER BY (id, created_at, game_id, player_alias_id);

  INSERT INTO ${process.env.CLICKHOUSE_DB}.events_new
  SELECT id, name, game_id, player_alias_id, dev_build, created_at, updated_at FROM ${process.env.CLICKHOUSE_DB}.events;

  RENAME TABLE ${process.env.CLICKHOUSE_DB}.events TO ${process.env.CLICKHOUSE_DB}.events_old,
                ${process.env.CLICKHOUSE_DB}.events_new TO ${process.env.CLICKHOUSE_DB}.events;

  DROP TABLE ${process.env.CLICKHOUSE_DB}.events_old;
`
