import { Migration } from '@mikro-orm/migrations'

export class CreatePlayerPresenceTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `player_presence` (`id` int unsigned not null auto_increment primary key, `player_alias_id` int unsigned not null, `online` tinyint(1) not null default false, `custom_status` varchar(255) not null default '', `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;",
    )
    this.addSql(
      'alter table `player_presence` add index `player_presence_player_alias_id_index`(`player_alias_id`);',
    )

    this.addSql(
      'alter table `player_presence` add constraint `player_presence_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade;',
    )

    this.addSql('alter table `player` add `presence_id` int unsigned null;')
    this.addSql(
      'alter table `player` add constraint `player_presence_id_foreign` foreign key (`presence_id`) references `player_presence` (`id`) on update cascade on delete set null;',
    )
    this.addSql('alter table `player` add unique `player_presence_id_unique`(`presence_id`);')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player` drop foreign key `player_presence_id_foreign`;')

    this.addSql('drop table if exists `player_presence`;')

    this.addSql('alter table `player` drop index `player_presence_id_unique`;')
    this.addSql('alter table `player` drop column `presence_id`;')
  }
}
