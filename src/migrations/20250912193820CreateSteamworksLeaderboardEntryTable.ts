import { Migration } from '@mikro-orm/migrations'

export class CreateSteamworksLeaderboardEntryTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `steamworks_leaderboard_entry` (`id` int unsigned not null auto_increment primary key, `steamworks_leaderboard_id` int unsigned not null, `leaderboard_id` int unsigned not null, `leaderboard_entry_id` int unsigned null, `steam_user_id` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `steamworks_leaderboard_entry` add unique `steamworks_leaderboard_entry_leaderboard_entry_id_unique`(`leaderboard_entry_id`);')
    this.addSql('alter table `steamworks_leaderboard_entry` add index `steamworks_leaderboard_entry_steamworks_leaderboard_aa6b4_index`(`steamworks_leaderboard_id`, `leaderboard_id`);')

    this.addSql('alter table `steamworks_leaderboard_entry` add constraint `steamworks_leaderboard_entry_steamworks_leaderboa_6dc1e_foreign` foreign key (`steamworks_leaderboard_id`, `leaderboard_id`) references `steamworks_leaderboard_mapping` (`steamworks_leaderboard_id`, `leaderboard_id`) on update cascade on delete cascade;')
    this.addSql('alter table `steamworks_leaderboard_entry` add constraint `steamworks_leaderboard_entry_leaderboard_entry_id_foreign` foreign key (`leaderboard_entry_id`) references `leaderboard_entry` (`id`) on update cascade on delete set null;')

    this.addSql(`
      insert into steamworks_leaderboard_entry (
        steamworks_leaderboard_id,
        leaderboard_id,
        leaderboard_entry_id,
        steam_user_id,
        created_at,
        updated_at
      ) 
      select
        slm.steamworks_leaderboard_id,
        le.leaderboard_id,
        le.id,
        pa.identifier,
        le.created_at,
        le.updated_at
      from leaderboard_entry le
        inner join steamworks_leaderboard_mapping slm on slm.leaderboard_id = le.leaderboard_id
        inner join player_alias pa on pa.id = le.player_alias_id and pa.service = 'steam'
    `)
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `steamworks_leaderboard_entry`;')
  }

}
