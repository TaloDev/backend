import { Migration } from '@mikro-orm/migrations'

export class CreateGameVerificationKeyTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`game_verification_key\` (\`id\` int unsigned not null auto_increment primary key, \`game_id\` int unsigned not null, \`version\` varchar(255) not null, \`value\` varchar(255) not null, \`created_at\` datetime not null) default character set utf8mb4 engine = InnoDB;`,
    )
    this.addSql(
      `alter table \`game_verification_key\` add index \`game_verification_key_game_id_index\` (\`game_id\`);`,
    )
    this.addSql(
      `alter table \`game_verification_key\` add constraint \`game_verification_key_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`game_verification_key\`;`)
  }
}
