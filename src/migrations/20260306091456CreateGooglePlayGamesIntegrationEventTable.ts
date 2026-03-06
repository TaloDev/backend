import { Migration } from '@mikro-orm/migrations'

export class CreateGooglePlayGamesIntegrationEventTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table `google_play_games_integration_event` (`id` int unsigned not null auto_increment primary key, `integration_id` int unsigned not null, `request` json not null, `response` json not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `google_play_games_integration_event` add index `google_play_games_integration_event_integration_id_index`(`integration_id`);',
    )
    this.addSql(
      'alter table `google_play_games_integration_event` add constraint `google_play_games_integration_event_integration_id_foreign` foreign key (`integration_id`) references `integration` (`id`) on update cascade;',
    )
    this.addSql(
      "alter table `integration` modify `type` enum('steamworks', 'google-play-games') not null;",
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `google_play_games_integration_event`;')
    this.addSql("alter table `integration` modify `type` enum('steamworks') not null;")
  }
}
