import { Migration } from '@mikro-orm/migrations'

export class CreateGameChannelStoragePropTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table `game_channel_storage_prop` (`id` int unsigned not null auto_increment primary key, `game_channel_id` int unsigned not null, `created_by_id` int unsigned not null, `last_updated_by_id` int unsigned not null, `key` varchar(128) not null, `value` varchar(512) not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `game_channel_storage_prop` add index `game_channel_storage_prop_game_channel_id_index`(`game_channel_id`);',
    )
    this.addSql(
      'alter table `game_channel_storage_prop` add index `game_channel_storage_prop_created_by_id_index`(`created_by_id`);',
    )
    this.addSql(
      'alter table `game_channel_storage_prop` add index `game_channel_storage_prop_last_updated_by_id_index`(`last_updated_by_id`);',
    )

    this.addSql(
      'alter table `game_channel_storage_prop` add constraint `game_channel_storage_prop_game_channel_id_foreign` foreign key (`game_channel_id`) references `game_channel` (`id`) on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table `game_channel_storage_prop` add constraint `game_channel_storage_prop_created_by_id_foreign` foreign key (`created_by_id`) references `player_alias` (`id`) on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table `game_channel_storage_prop` add constraint `game_channel_storage_prop_last_updated_by_id_foreign` foreign key (`last_updated_by_id`) references `player_alias` (`id`) on update cascade on delete cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `game_channel_storage_prop`;')
  }
}
