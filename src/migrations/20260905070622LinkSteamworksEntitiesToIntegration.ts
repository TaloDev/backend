import { Migration } from '@mikro-orm/migrations'

export class LinkSteamworksEntitiesToIntegration extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add \`integration_id\` int unsigned null;`,
    )
    this.addSql(`alter table \`steamworks_player_stat\` add \`integration_id\` int unsigned null;`)

    // purge orphans - rows whose game has no steamworks integration can't be
    // backfilled and would fail the not-null modify below
    this.addSql(`
      delete slm from steamworks_leaderboard_mapping slm
        left join leaderboard l on l.id = slm.leaderboard_id
        left join integration i on i.game_id = l.game_id and i.type = 'steamworks'
      where i.id is null
    `)
    this.addSql(`
      delete sps from steamworks_player_stat sps
        left join game_stat gs on gs.id = sps.stat_id
        left join integration i on i.game_id = gs.game_id and i.type = 'steamworks'
      where i.id is null
    `)

    // backfill from the game's single steamworks integration
    this.addSql(`
      update steamworks_leaderboard_mapping slm
        inner join leaderboard l on l.id = slm.leaderboard_id
        inner join integration i on i.game_id = l.game_id and i.type = 'steamworks'
      set slm.integration_id = i.id
    `)
    this.addSql(`
      update steamworks_player_stat sps
        inner join game_stat gs on gs.id = sps.stat_id
        inner join integration i on i.game_id = gs.game_id and i.type = 'steamworks'
      set sps.integration_id = i.id
    `)

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` modify \`integration_id\` int unsigned not null;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` modify \`integration_id\` int unsigned not null;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add constraint \`steamworks_leaderboard_mapping_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add index \`steamworks_leaderboard_mapping_integration_id_index\` (\`integration_id\`);`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` add constraint \`steamworks_player_stat_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` add index \`steamworks_player_stat_integration_id_index\` (\`integration_id\`);`,
    )

    // plain indexes first - the FKs depend on the uniques being replaced
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add index \`steamworks_leaderboard_entry_leaderboard_entry_id_index\` (\`leaderboard_entry_id\`);`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop index \`steamworks_leaderboard_entry_leaderboard_entry_id_unique\`;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` add index \`steamworks_player_stat_player_stat_id_index\` (\`player_stat_id\`);`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` drop index \`steamworks_player_stat_player_stat_id_unique\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` add unique \`steamworks_player_stat_integration_id_player_stat_id_unique\` (\`integration_id\`, \`player_stat_id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` drop foreign key \`steamworks_leaderboard_mapping_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` drop foreign key \`steamworks_player_stat_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` drop index \`steamworks_player_stat_integration_id_player_stat_id_unique\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` add unique \`steamworks_player_stat_player_stat_id_unique\` (\`player_stat_id\`);`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` drop index \`steamworks_player_stat_player_stat_id_index\`;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` drop index \`steamworks_player_stat_integration_id_index\`;`,
    )
    this.addSql(`alter table \`steamworks_player_stat\` drop column \`integration_id\`;`)

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add unique \`steamworks_leaderboard_entry_leaderboard_entry_id_unique\` (\`leaderboard_entry_id\`);`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop index \`steamworks_leaderboard_entry_leaderboard_entry_id_index\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` drop index \`steamworks_leaderboard_mapping_integration_id_index\`;`,
    )
    this.addSql(`alter table \`steamworks_leaderboard_mapping\` drop column \`integration_id\`;`)
  }
}
