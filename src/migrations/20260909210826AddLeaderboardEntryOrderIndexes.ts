import { Migration } from '@mikro-orm/migrations'

export class AddLeaderboardEntryOrderIndexes extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_order_desc\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`score\` desc, \`created_at\`, \`id\`);`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_order_asc\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`score\`, \`created_at\`, \`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_order_desc\`;`)
    this.addSql(`alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_order_asc\`;`)
  }
}
