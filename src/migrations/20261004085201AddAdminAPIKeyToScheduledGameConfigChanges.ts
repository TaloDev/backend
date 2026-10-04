import { Migration } from '@mikro-orm/migrations'

export class AddAdminAPIKeyToScheduledGameConfigChanges extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`scheduled_game_config_change\` drop foreign key \`scheduled_game_config_change_created_by_user_id_foreign\`;`,
    )

    this.addSql(`alter table \`admin_apikey\` modify \`scopes\` text not null;`)

    this.addSql(
      `alter table \`scheduled_game_config_change\` add \`created_by_admin_apikey_id\` int unsigned null;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add constraint \`scheduled_game_config_change_created_by_admin_apikey_id_foreign\` foreign key (\`created_by_admin_apikey_id\`) references \`admin_apikey\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` modify \`created_by_user_id\` int unsigned null;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add constraint \`scheduled_game_config_change_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add index \`scheduled_game_config_change_created_by_admin_apikey_id_index\` (\`created_by_admin_apikey_id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`scheduled_game_config_change\` drop foreign key \`scheduled_game_config_change_created_by_admin_apikey_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` drop foreign key \`scheduled_game_config_change_created_by_user_id_foreign\`;`,
    )

    this.addSql(`alter table \`admin_apikey\` modify \`scopes\` text not null;`)

    this.addSql(
      `alter table \`scheduled_game_config_change\` drop index \`scheduled_game_config_change_created_by_admin_apikey_id_index\`;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` drop column \`created_by_admin_apikey_id\`;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` modify \`created_by_user_id\` int unsigned not null;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add constraint \`scheduled_game_config_change_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`);`,
    )
  }
}
