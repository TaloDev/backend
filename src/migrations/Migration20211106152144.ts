import { Migration } from '@mikro-orm/migrations'

export class Migration20211106152144 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `leaderboard` (`id` int unsigned not null auto_increment primary key, `internal_name` varchar(255) not null, `name` varchar(255) not null, `sort_mode` enum(\'desc\', \'asc\') not null, `game_id` int(11) unsigned not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `leaderboard` add index `leaderboard_game_id_index`(`game_id`);')

    this.addSql('create table `leaderboard_entry` (`id` int unsigned not null auto_increment primary key, `score` double not null, `leaderboard_id` int(11) unsigned not null, `player_alias_id` int(11) unsigned not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `leaderboard_entry` add index `leaderboard_entry_leaderboard_id_index`(`leaderboard_id`);')
    this.addSql('alter table `leaderboard_entry` add index `leaderboard_entry_player_alias_id_index`(`player_alias_id`);')

    this.addSql('alter table `leaderboard` add constraint `leaderboard_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;')

    this.addSql('alter table `leaderboard_entry` add constraint `leaderboard_entry_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on update cascade;')
    this.addSql('alter table `leaderboard_entry` add constraint `leaderboard_entry_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade;')
  }

}
