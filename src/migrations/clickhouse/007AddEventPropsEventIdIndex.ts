export const AddEventPropsEventIdIndex = `ALTER TABLE ${process.env.CLICKHOUSE_DB}.event_props ADD INDEX IF NOT EXISTS event_id_idx (event_id) TYPE minmax GRANULARITY 64;`
