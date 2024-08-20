CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DB}.event_props (
    event_id String,
    prop_key String,
    prop_value String
) ENGINE = MergeTree()
ORDER BY (event_id, prop_key);
