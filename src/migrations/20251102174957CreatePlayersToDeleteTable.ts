import { Migration } from '@mikro-orm/migrations'

export class CreatePlayersToDeleteTable extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table `players_to_delete` (`id` int unsigned not null auto_increment primary key, `player_id` varchar(255) not null, `queued_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `players_to_delete` add index `players_to_delete_player_id_index`(`player_id`);',
    )

    this.addSql(
      'alter table `players_to_delete` add constraint `players_to_delete_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `players_to_delete`;')
  }
}
