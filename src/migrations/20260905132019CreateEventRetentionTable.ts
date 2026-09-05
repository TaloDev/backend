import { Migration } from '@mikro-orm/migrations'

export class CreateEventRetentionTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`event_retention\` (\`id\` int unsigned not null auto_increment primary key, \`event_name\` varchar(255) not null, \`retention_days\` int not null, \`game_id\` int unsigned not null, \`created_at\` datetime not null, \`updated_at\` datetime not null) default character set utf8mb4 engine = InnoDB;`,
    )
    this.addSql(
      `alter table \`event_retention\` add index \`event_retention_game_id_index\` (\`game_id\`);`,
    )
    this.addSql(
      `alter table \`event_retention\` add unique \`event_retention_game_id_event_name_unique\` (\`game_id\`, \`event_name\`);`,
    )

    this.addSql(
      `alter table \`event_retention\` add constraint \`event_retention_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`event_retention\`;`)
  }
}
