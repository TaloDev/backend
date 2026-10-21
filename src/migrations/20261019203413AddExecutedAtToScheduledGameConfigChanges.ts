import { Migration } from '@mikro-orm/migrations'

export class AddExecutedAtToScheduledGameConfigChanges extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`scheduled_game_config_change\` drop index \`scheduled_game_config_change_apply_at_index\`;`,
    )
    this.addSql(`alter table \`scheduled_game_config_change\` add \`executed_at\` datetime null;`)
    this.addSql(
      `alter table \`scheduled_game_config_change\` add index \`scheduled_game_config_change_executed_at_apply_at_index\` (\`executed_at\`, \`apply_at\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`scheduled_game_config_change\` drop index \`scheduled_game_config_change_executed_at_apply_at_index\`;`,
    )
    this.addSql(`alter table \`scheduled_game_config_change\` drop column \`executed_at\`;`)
    this.addSql(
      `alter table \`scheduled_game_config_change\` add index \`scheduled_game_config_change_apply_at_index\` (\`apply_at\`);`,
    )
  }
}
