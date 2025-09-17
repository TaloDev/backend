import { Migration } from '@mikro-orm/migrations'

export class CreateSteamworksPlayerStatTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `steamworks_player_stat` (`id` int unsigned not null auto_increment primary key, `stat_id` int unsigned not null, `player_stat_id` int unsigned null, `steam_user_id` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `steamworks_player_stat` add index `steamworks_player_stat_stat_id_index`(`stat_id`);')
    this.addSql('alter table `steamworks_player_stat` add unique `steamworks_player_stat_player_stat_id_unique`(`player_stat_id`);')

    this.addSql('alter table `steamworks_player_stat` add constraint `steamworks_player_stat_stat_id_foreign` foreign key (`stat_id`) references `game_stat` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `steamworks_player_stat` add constraint `steamworks_player_stat_player_stat_id_foreign` foreign key (`player_stat_id`) references `player_game_stat` (`id`) on update cascade on delete set null;')

    this.addSql(`
      insert into steamworks_player_stat (
        stat_id,
        player_stat_id,
        steam_user_id,
        created_at,
        updated_at
      ) 
      select
        pgs.stat_id,
        pgs.id,
        pa.identifier,
        pgs.created_at,
        pgs.updated_at
      from player_game_stat pgs
        inner join game_stat gs on gs.id = pgs.stat_id
        inner join integration i on i.game_id = gs.game_id and i.type = 'steamworks'
        inner join player p on p.id = pgs.player_id
        inner join player_alias pa on pa.player_id = p.id and pa.service = 'steam'
    `)
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `steamworks_player_stat`;')
  }

}
