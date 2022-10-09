import { Migration } from '@mikro-orm/migrations'

export class CreatePlayerGroupsTables extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `player_group` (`id` varchar(255) not null primary key, `name` varchar(255) not null, `description` varchar(255) not null, `rules` json not null, `rule_mode` enum(\'$and\', \'$or\') not null, `game_id` int unsigned not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `player_group` add index `player_group_game_id_index`(`game_id`);')

    this.addSql('create table `player_group_members` (`player_group_id` varchar(255) not null, `player_id` varchar(255) not null, primary key (`player_group_id`, `player_id`)) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `player_group_members` add index `player_group_members_player_group_id_index`(`player_group_id`);')
    this.addSql('alter table `player_group_members` add index `player_group_members_player_id_index`(`player_id`);')

    this.addSql('alter table `player_group` add constraint `player_group_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;')

    this.addSql('alter table `player_group_members` add constraint `player_group_members_player_group_id_foreign` foreign key (`player_group_id`) references `player_group` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `player_group_members` add constraint `player_group_members_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;')
  }

  async down(): Promise<void> {
    this.addSql('alter table `player_group_members` drop foreign key `player_group_members_player_group_id_foreign`;')

    this.addSql('drop table if exists `player_group`;')

    this.addSql('drop table if exists `player_group_members`;')
  }

}
