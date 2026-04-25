export const AddGameIdToEventProps = `
  DROP TABLE IF EXISTS ${process.env.CLICKHOUSE_DB}.event_props_new;

  CREATE TABLE ${process.env.CLICKHOUSE_DB}.event_props_new
  (
    event_id String,
    prop_key String,
    prop_value String,
    game_id UInt32,
    dev_build Boolean,
    created_at DateTime64(3)
  ) ENGINE = MergeTree()
  ORDER BY (game_id, created_at, event_id, prop_key);

  INSERT INTO ${process.env.CLICKHOUSE_DB}.event_props_new
  SELECT ep.event_id, ep.prop_key, ep.prop_value, e.game_id, e.dev_build, e.created_at
  FROM ${process.env.CLICKHOUSE_DB}.event_props ep
  JOIN ${process.env.CLICKHOUSE_DB}.events e ON ep.event_id = e.id;

  EXCHANGE TABLES ${process.env.CLICKHOUSE_DB}.event_props AND ${process.env.CLICKHOUSE_DB}.event_props_new;

  DROP TABLE ${process.env.CLICKHOUSE_DB}.event_props_new;
`
