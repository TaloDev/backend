export const SwitchPlayerSessionsToReplacingMergeTree = `
  DROP TABLE IF EXISTS player_sessions_new;

  CREATE TABLE player_sessions_new
  (
    id UUID DEFAULT generateUUIDv4(),
    player_id String,
    game_id UInt32,
    dev_build Boolean,
    started_at DateTime64(3),
    ended_at Nullable(DateTime64(3)),
    version UInt64 DEFAULT 0,
    PRIMARY KEY (player_id, id)
  ) ENGINE = ReplacingMergeTree(version)
  ORDER BY (player_id, id);

  INSERT INTO player_sessions_new
  SELECT id, player_id, game_id, dev_build, started_at, ended_at,
         if(ended_at IS NULL, 0, toUInt64(toUnixTimestamp64Milli(ended_at))) AS version
  FROM player_sessions;

  EXCHANGE TABLES player_sessions AND player_sessions_new;

  DROP TABLE player_sessions_new;
`
