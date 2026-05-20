export const ReorderEventsSortKey = `
  DROP TABLE IF EXISTS events_new;

  CREATE TABLE events_new
  (
    id String,
    name String,
    game_id UInt32,
    player_alias_id UInt32,
    dev_build Boolean,
    created_at DateTime64(3),
    updated_at DateTime64(3),
    PRIMARY KEY (game_id, created_at, id),
    INDEX player_alias_id_idx (player_alias_id) TYPE minmax GRANULARITY 64
  ) ENGINE = MergeTree()
  ORDER BY (game_id, created_at, id);

  INSERT INTO events_new
  SELECT id, name, game_id, player_alias_id, dev_build, created_at, updated_at FROM events;

  EXCHANGE TABLES events AND events_new;

  DROP TABLE events_new;
`
