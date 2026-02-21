import { Migration } from '@mikro-orm/migrations'

export class CreateSteamIntegrationTables extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `steamworks_integration_event` (`id` int unsigned not null auto_increment primary key, `integration_id` int unsigned not null, `request` json not null, `response` json not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `steamworks_integration_event` add index `steamworks_integration_event_integration_id_index`(`integration_id`);',
    )

    this.addSql(
      'alter table `steamworks_integration_event` add constraint `steamworks_integration_event_integration_id_foreign` foreign key (`integration_id`) references `integration` (`id`) on update cascade;',
    )

    this.addSql(
      'create table `steamworks_leaderboard_mapping` (`steamworks_leaderboard_id` int unsigned not null, `leaderboard_id` int unsigned not null, `created_at` datetime not null, primary key (`steamworks_leaderboard_id`, `leaderboard_id`)) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` add unique `steamworks_leaderboard_mapping_leaderboard_id_unique`(`leaderboard_id`);',
    )

    this.addSql(
      'alter table `steamworks_leaderboard_mapping` add constraint `steamworks_leaderboard_mapping_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on delete cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `steam_integration_event`;')

    this.addSql('drop table if exists `steamworks_leaderboard_mapping`;')
  }
}
