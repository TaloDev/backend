export const CreateEventPropsTable = `CREATE TABLE IF NOT EXISTS ${process.env.CLICKHOUSE_DB}.event_props (
  event_id String,
  prop_key String,
  prop_value String
) ENGINE = MergeTree()
ORDER BY (event_id, prop_key);`
