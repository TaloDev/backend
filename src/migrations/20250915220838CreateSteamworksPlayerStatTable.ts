import { Migration } from '@mikro-orm/migrations'

export class CreateSteamworksPlayerStatTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `steamworks_player_stat` (`id` int unsigned not null auto_increment primary key, `stat_id` int unsigned not null, `player_stat_id` int unsigned null, `steam_user_id` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `steamworks_player_stat` add index `steamworks_player_stat_stat_id_index`(`stat_id`);')
    this.addSql('alter table `steamworks_player_stat` add unique `steamworks_player_stat_player_stat_id_unique`(`player_stat_id`);')

    this.addSql('alter table `steamworks_player_stat` add constraint `steamworks_player_stat_stat_id_foreign` foreign key (`stat_id`) references `game_stat` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `steamworks_player_stat` add constraint `steamworks_player_stat_player_stat_id_foreign` foreign key (`player_stat_id`) references `player_game_stat` (`id`) on update cascade on delete set null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `steamworks_player_stat`;')
  }

}
