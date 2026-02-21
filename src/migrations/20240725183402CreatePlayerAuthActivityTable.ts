import { Migration } from '@mikro-orm/migrations'

export class CreatePlayerAuthActivityTable extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `player_auth_activity` (`id` int unsigned not null auto_increment primary key, `player_id` varchar(255) not null, `type` tinyint not null, `extra` json not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `player_auth_activity` add index `player_auth_activity_player_id_index`(`player_id`);',
    )

    this.addSql(
      'alter table `player_auth_activity` add constraint `player_auth_activity_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `player_auth_activity`;')
  }
}
