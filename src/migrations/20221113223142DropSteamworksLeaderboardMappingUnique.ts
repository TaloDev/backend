import { Migration } from '@mikro-orm/migrations'

export class DropSteamworksLeaderboardMappingUnique extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` drop foreign key `steamworks_leaderboard_mapping_leaderboard_id_foreign`;',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` drop index `steamworks_leaderboard_mapping_leaderboard_id_unique`;',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` add index `steamworks_leaderboard_mapping_leaderboard_id_index`(`leaderboard_id`);',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` add constraint `steamworks_leaderboard_mapping_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on delete cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` drop foreign key `steamworks_leaderboard_mapping_leaderboard_id_foreign`;',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` drop index `steamworks_leaderboard_mapping_leaderboard_id_index`;',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` add unique `steamworks_leaderboard_mapping_leaderboard_id_unique`(`leaderboard_id`);',
    )
    this.addSql(
      'alter table `steamworks_leaderboard_mapping` add constraint `steamworks_leaderboard_mapping_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on delete cascade;',
    )
  }
}
