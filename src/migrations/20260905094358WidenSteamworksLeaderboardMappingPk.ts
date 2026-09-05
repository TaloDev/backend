import { Migration } from '@mikro-orm/migrations'

export class WidenSteamworksLeaderboardMappingPk extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop foreign key \`steamworks_leaderboard_entry_steamworks_leaderboa_15279_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop index \`steamworks_leaderboard_entry_steamworks_leaderboard_47d69_index\`;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add \`integration_id\` int unsigned null;`,
    )

    this.addSql(`alter table \`steamworks_leaderboard_mapping\` drop primary key;`)
    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add primary key (\`steamworks_leaderboard_id\`, \`leaderboard_id\`, \`integration_id\`);`,
    )

    // copy the integration from the entry's mapping
    this.addSql(`
      update steamworks_leaderboard_entry se
        inner join steamworks_leaderboard_mapping sm
          on sm.steamworks_leaderboard_id = se.steamworks_leaderboard_id
          and sm.leaderboard_id = se.leaderboard_id
      set se.integration_id = sm.integration_id
    `)
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` modify \`integration_id\` int unsigned not null;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add constraint \`steamworks_leaderboard_entry_steamworks_leaderboa_6bddf_foreign\` foreign key (\`steamworks_leaderboard_id\`, \`leaderboard_id\`, \`integration_id\`) references \`steamworks_leaderboard_mapping\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`, \`integration_id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add index \`steamworks_leaderboard_entry_steamworks_leaderboard_54c77_index\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`, \`integration_id\`);`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add unique \`steamworks_leaderboard_entry_steamworks_leaderboar_3f388_unique\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`, \`integration_id\`, \`leaderboard_entry_id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop foreign key \`steamworks_leaderboard_entry_steamworks_leaderboa_6bddf_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop index \`steamworks_leaderboard_entry_steamworks_leaderboard_54c77_index\`;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop index \`steamworks_leaderboard_entry_steamworks_leaderboar_3f388_unique\`;`,
    )
    this.addSql(`alter table \`steamworks_leaderboard_entry\` drop column \`integration_id\`;`)

    this.addSql(`alter table \`steamworks_leaderboard_mapping\` drop primary key;`)
    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add primary key (\`steamworks_leaderboard_id\`, \`leaderboard_id\`);`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add constraint \`steamworks_leaderboard_entry_steamworks_leaderboa_15279_foreign\` foreign key (\`steamworks_leaderboard_id\`, \`leaderboard_id\`) references \`steamworks_leaderboard_mapping\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add index \`steamworks_leaderboard_entry_steamworks_leaderboard_47d69_index\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`);`,
    )
  }
}
