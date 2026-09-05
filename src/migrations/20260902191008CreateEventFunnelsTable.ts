import { Migration } from '@mikro-orm/migrations'

export class CreateEventFunnelsTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`event_funnel\` (\`id\` int unsigned not null auto_increment primary key, \`name\` varchar(255) not null, \`steps\` json not null, \`max_gap\` int not null, \`game_id\` int unsigned not null, \`created_at\` datetime not null, \`updated_at\` datetime not null) default character set utf8mb4 engine = InnoDB;`,
    )
    this.addSql(
      `alter table \`event_funnel\` add index \`event_funnel_game_id_index\` (\`game_id\`);`,
    )

    this.addSql(
      `alter table \`event_funnel\` add constraint \`event_funnel_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`event_funnel\`;`)
  }
}
