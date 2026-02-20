import { Migration } from '@mikro-orm/migrations'

export class CreateGameStatsTable extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `game_stat` (`id` int unsigned not null auto_increment primary key, `internal_name` varchar(255) not null, `name` varchar(255) not null, `global` tinyint(1) not null, `global_value` double not null, `max_change` double null, `min_value` double null, `max_value` double null, `default_value` double not null, `min_time_between_updates` int not null, `game_id` int unsigned not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql('alter table `game_stat` add index `game_stat_game_id_index`(`game_id`);')

    this.addSql(
      'create table `player_game_stat` (`id` int unsigned not null auto_increment primary key, `player_id` varchar(255) null, `stat_id` int unsigned null, `value` double not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `player_game_stat` add index `player_game_stat_player_id_index`(`player_id`);',
    )
    this.addSql(
      'alter table `player_game_stat` add index `player_game_stat_stat_id_index`(`stat_id`);',
    )

    this.addSql(
      'alter table `game_stat` add constraint `game_stat_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;',
    )

    this.addSql(
      'alter table `player_game_stat` add constraint `player_game_stat_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on delete cascade;',
    )
    this.addSql(
      'alter table `player_game_stat` add constraint `player_game_stat_stat_id_foreign` foreign key (`stat_id`) references `game_stat` (`id`) on delete cascade;',
    )

    this.addSql('alter table `data_export` modify `entities` text not null;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `player_game_stat` drop foreign key `player_game_stat_stat_id_foreign`;',
    )

    this.addSql('drop table if exists `game_stat`;')

    this.addSql('drop table if exists `player_game_stat`;')

    this.addSql('alter table `data_export` modify `entities` text not null;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }
}
