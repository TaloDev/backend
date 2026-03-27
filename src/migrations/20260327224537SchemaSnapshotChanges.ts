import { Migration } from '@mikro-orm/migrations'

export class SchemaSnapshotChanges extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table \`user_recovery_code\` drop foreign key \`user_recovery_code_user_id_foreign\`;`,
    )

    this.addSql(`alter table \`player_prop\` modify \`created_at\` datetime not null;`)

    this.addSql(`alter table \`player_alias\` modify \`last_seen_at\` datetime not null;`)

    this.addSql(
      `alter table \`leaderboard_entry_prop\` rename index \`leaderboard_entry_prop_entry_id_index\` to \`leaderboard_entry_prop_leaderboard_entry_id_index\`;`,
    )

    this.addSql(
      `alter table \`user_two_factor_auth\` modify \`enabled\` tinyint(1) not null default false;`,
    )

    this.addSql(
      `alter table \`user_recovery_code\` add constraint \`user_recovery_code_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(`alter table \`data_export\` modify \`entities\` text not null;`)

    this.addSql(`alter table \`apikey\` modify \`scopes\` text not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table \`user_recovery_code\` drop foreign key \`user_recovery_code_user_id_foreign\`;`,
    )

    this.addSql(`alter table \`apikey\` modify \`scopes\` text not null;`)

    this.addSql(`alter table \`data_export\` modify \`entities\` text not null;`)

    this.addSql(
      `alter table \`leaderboard_entry_prop\` rename index \`leaderboard_entry_prop_leaderboard_entry_id_index\` to \`leaderboard_entry_prop_entry_id_index\`;`,
    )

    this.addSql(
      `alter table \`player_alias\` modify \`last_seen_at\` datetime not null default CURRENT_TIMESTAMP;`,
    )

    this.addSql(
      `alter table \`player_prop\` modify \`created_at\` datetime not null default CURRENT_TIMESTAMP;`,
    )

    this.addSql(
      `alter table \`user_recovery_code\` add constraint \`user_recovery_code_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update no action on delete cascade;`,
    )

    this.addSql(
      `alter table \`user_two_factor_auth\` modify \`enabled\` tinyint(1) null default false;`,
    )
  }
}
