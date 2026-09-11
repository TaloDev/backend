import { Migration } from '@mikro-orm/migrations'

export class AddLeaderboardEntryPropKeyValueIndex extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`leaderboard_entry_prop\` add index \`leaderboard_entry_prop_key_value_index\` (\`key\`, \`value\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`leaderboard_entry_prop\` drop index \`leaderboard_entry_prop_key_value_index\`;`,
    )
  }
}
