import { Migration } from '@mikro-orm/migrations'

export class RemoveIntegrationSoftDelete extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`google_play_games_integration_event\` drop foreign key \`google_play_games_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_center_integration_event\` drop foreign key \`game_center_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` drop foreign key \`steamworks_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`google_play_games_integration_event\` add constraint \`google_play_games_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_center_integration_event\` add constraint \`game_center_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` add constraint \`steamworks_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on delete cascade;`,
    )

    // purge soft-deleted integrations, cascading to their request logs
    this.addSql('delete from `integration` where `deleted_at` is not null;')

    this.addSql(`alter table \`integration\` drop column \`deleted_at\`;`)
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`game_center_integration_event\` drop foreign key \`game_center_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`google_play_games_integration_event\` drop foreign key \`google_play_games_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` drop foreign key \`steamworks_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_center_integration_event\` add constraint \`game_center_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`google_play_games_integration_event\` add constraint \`google_play_games_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`);`,
    )

    this.addSql(`alter table \`integration\` add \`deleted_at\` datetime null;`)

    this.addSql(
      `alter table \`steamworks_integration_event\` add constraint \`steamworks_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`);`,
    )
  }
}
