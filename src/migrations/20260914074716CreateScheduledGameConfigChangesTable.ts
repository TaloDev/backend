import { Migration } from '@mikro-orm/migrations'

export class CreateScheduledGameConfigChangesTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`scheduled_game_config_change\` (\`id\` int unsigned not null auto_increment primary key, \`game_id\` int unsigned not null, \`key\` varchar(128) not null, \`value\` text null, \`apply_at\` datetime not null, \`created_by_user_id\` int unsigned not null, \`created_at\` datetime not null) default character set utf8mb4 engine = InnoDB;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add index \`scheduled_game_config_change_game_id_index\` (\`game_id\`);`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add index \`scheduled_game_config_change_apply_at_index\` (\`apply_at\`);`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add index \`scheduled_game_config_change_created_by_user_id_index\` (\`created_by_user_id\`);`,
    )

    this.addSql(
      `alter table \`scheduled_game_config_change\` add constraint \`scheduled_game_config_change_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`scheduled_game_config_change\` add constraint \`scheduled_game_config_change_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`scheduled_game_config_change\`;`)
  }
}
