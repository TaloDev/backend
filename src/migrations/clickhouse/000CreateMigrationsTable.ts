export const CreateMigrationsTable = `CREATE TABLE IF NOT EXISTS migrations (
  name String,
  executed_at DateTime,
  PRIMARY KEY (name)
) ENGINE = MergeTree()
ORDER BY (name, executed_at);`
