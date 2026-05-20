export const AddGameIdToEventProps = `
  DROP TABLE IF EXISTS event_props_new;

  CREATE TABLE event_props_new
  (
    event_id String,
    prop_key String,
    prop_value String,
    game_id UInt32,
    dev_build Boolean,
    created_at DateTime64(3)
  ) ENGINE = MergeTree()
  ORDER BY (game_id, created_at, event_id, prop_key);

  INSERT INTO event_props_new
  SELECT ep.event_id, ep.prop_key, ep.prop_value, e.game_id, e.dev_build, e.created_at
  FROM event_props ep
  JOIN events e ON ep.event_id = e.id;

  EXCHANGE TABLES event_props AND event_props_new;

  DROP TABLE event_props_new;
`
