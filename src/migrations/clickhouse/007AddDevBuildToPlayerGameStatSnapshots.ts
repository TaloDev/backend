export const AddDevBuildToPlayerGameStatSnapshots = `ALTER TABLE ${process.env.CLICKHOUSE_DB}.player_game_stat_snapshots ADD COLUMN IF NOT EXISTS dev_build Boolean DEFAULT false;`
