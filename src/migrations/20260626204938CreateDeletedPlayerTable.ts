import { Migration } from '@mikro-orm/migrations'

export class CreateDeletedPlayerTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`deleted_player\` (\`id\` int unsigned not null auto_increment primary key, \`game_id\` int unsigned not null, \`dev_build\` tinyint(1) not null, \`created_at\` datetime not null, \`deleted_at\` datetime not null) default character set utf8mb4 engine = InnoDB;`,
    )
    this.addSql(
      `alter table \`deleted_player\` add index \`deleted_player_game_id_index\` (\`game_id\`);`,
    )
    this.addSql(
      `alter table \`deleted_player\` add index \`deleted_player_game_id_created_at_index\` (\`game_id\`, \`created_at\`);`,
    )

    this.addSql(
      `alter table \`deleted_player\` add constraint \`deleted_player_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on delete cascade;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`deleted_player\`;`)
  }
}
