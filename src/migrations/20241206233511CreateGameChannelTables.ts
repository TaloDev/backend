import { Migration } from '@mikro-orm/migrations'

export class CreateGameChannelTables extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `game_channel` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `owner_id` int unsigned not null, `game_id` int unsigned not null, `props` json not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_channel` add index `game_channel_owner_id_index`(`owner_id`);')
    this.addSql('alter table `game_channel` add index `game_channel_game_id_index`(`game_id`);')

    this.addSql('create table `game_channel_members` (`game_channel_id` int unsigned not null, `player_alias_id` int unsigned not null, primary key (`game_channel_id`, `player_alias_id`)) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_channel_members` add index `game_channel_members_game_channel_id_index`(`game_channel_id`);')
    this.addSql('alter table `game_channel_members` add index `game_channel_members_player_alias_id_index`(`player_alias_id`);')

    this.addSql('alter table `game_channel` add constraint `game_channel_owner_id_foreign` foreign key (`owner_id`) references `player_alias` (`id`) on delete cascade;')
    this.addSql('alter table `game_channel` add constraint `game_channel_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;')

    this.addSql('alter table `game_channel_members` add constraint `game_channel_members_game_channel_id_foreign` foreign key (`game_channel_id`) references `game_channel` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `game_channel_members` add constraint `game_channel_members_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_channel_members` drop foreign key `game_channel_members_game_channel_id_foreign`;')

    this.addSql('drop table if exists `game_channel`;')

    this.addSql('drop table if exists `game_channel_members`;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

}
