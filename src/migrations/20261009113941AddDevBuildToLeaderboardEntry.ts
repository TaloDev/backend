import { Migration } from '@mikro-orm/migrations'

export class AddDevBuildToLeaderboardEntry extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`leaderboard_entry\` add \`dev_build\` tinyint(1) not null default false;`,
    )

    // backfill from the player, the previous source of truth
    this.addSql(
      `update leaderboard_entry le
        inner join player_alias pa on pa.id = le.player_alias_id
        inner join player p on p.id = pa.player_id
        set le.dev_build = p.dev_build;`,
    )

    this.addSql(`alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_order_desc\`;`)
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_order_desc\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`dev_build\`, \`score\` desc, \`created_at\`, \`id\`);`,
    )
    this.addSql(`alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_order_asc\`;`)
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_order_asc\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`dev_build\`, \`score\`, \`created_at\`, \`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_order_desc\`;`)
    this.addSql(`alter table \`leaderboard_entry\` drop index \`idx_leaderboardentry_order_asc\`;`)
    this.addSql(`alter table \`leaderboard_entry\` drop column \`dev_build\`;`)
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_order_desc\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`score\` desc, \`created_at\`, \`id\`);`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` add index \`idx_leaderboardentry_order_asc\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`score\`, \`created_at\`, \`id\`);`,
    )
  }
}
