import { Migration } from '@mikro-orm/migrations'

export class CreateAdminAPIKeysTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`admin_apikey\` (\`id\` int unsigned not null auto_increment primary key, \`scopes\` text not null, \`key_hash\` varchar(255) not null, \`key_ending\` varchar(8) not null, \`game_id\` int unsigned not null, \`created_by_user_id\` int unsigned not null, \`created_at\` datetime not null, \`updated_at\` datetime null, \`revoked_at\` datetime null, \`last_used_at\` datetime null) default character set utf8mb4 engine = InnoDB;`,
    )
    this.addSql(
      `alter table \`admin_apikey\` add unique \`admin_apikey_key_hash_unique\` (\`key_hash\`);`,
    )
    this.addSql(
      `alter table \`admin_apikey\` add index \`admin_apikey_game_id_index\` (\`game_id\`);`,
    )
    this.addSql(
      `alter table \`admin_apikey\` add index \`admin_apikey_created_by_user_id_index\` (\`created_by_user_id\`);`,
    )
    this.addSql(
      `alter table \`admin_apikey\` add constraint \`admin_apikey_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`admin_apikey\` add constraint \`admin_apikey_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`);`,
    )

    this.addSql(`alter table \`game_activity\` drop foreign key \`game_activity_user_id_foreign\`;`)
    this.addSql(`alter table \`game_activity\` add \`admin_apikey_id\` int unsigned null;`)
    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_admin_apikey_id_foreign\` foreign key (\`admin_apikey_id\`) references \`admin_apikey\` (\`id\`) on delete set null;`,
    )
    this.addSql(`alter table \`game_activity\` modify \`user_id\` int unsigned null;`)
    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`game_activity\` add index \`game_activity_admin_apikey_id_index\` (\`admin_apikey_id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`game_activity\` drop foreign key \`game_activity_admin_apikey_id_foreign\`;`,
    )
    this.addSql(`alter table \`game_activity\` drop index \`game_activity_admin_apikey_id_index\`;`)
    this.addSql(`alter table \`game_activity\` drop column \`admin_apikey_id\`;`)

    this.addSql(`alter table \`game_activity\` drop foreign key \`game_activity_user_id_foreign\`;`)
    this.addSql(`alter table \`game_activity\` modify \`user_id\` int unsigned not null;`)
    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`);`,
    )

    this.addSql(`drop table if exists \`admin_apikey\`;`)
  }
}
