export const AddDevBuildToPlayerGameStatSnapshots = `ALTER TABLE player_game_stat_snapshots ADD COLUMN IF NOT EXISTS dev_build Boolean DEFAULT false;`
