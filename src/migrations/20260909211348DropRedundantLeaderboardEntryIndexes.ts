import { Migration } from '@mikro-orm/migrations'

export class DropRedundantLeaderboardEntryIndexes extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table \`leaderboard_entry\` drop index \`leaderboard_entry_hidden_index\`;`)

    // both order indexes lead with leaderboard_id, so the auto-created fk index is redundant
    this.addSql(
      `alter table \`leaderboard_entry\` drop index \`leaderboard_entry_leaderboard_id_index\`;`,
    )

    this.addSql(
      `alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_hidden_leaderboard_id_score\`;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`leaderboard_entry_hidden_index\` (\`hidden\`);`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`leaderboard_entry_leaderboard_id_index\` (\`leaderboard_id\`);`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_hidden_leaderboard_id_score\`(\`hidden\`, \`leaderboard_id\`, \`score\`);`,
    )
  }
}
