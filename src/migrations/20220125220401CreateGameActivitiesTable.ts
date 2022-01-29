import { Migration } from '@mikro-orm/migrations'

export class CreateGameActivitiesTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `game_activity` (`id` int unsigned not null auto_increment primary key, `game_id` int(11) unsigned not null, `user_id` int(11) unsigned not null, `type` tinyint not null, `extra` json not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_activity` add index `game_activity_game_id_index`(`game_id`);')
    this.addSql('alter table `game_activity` add index `game_activity_user_id_index`(`user_id`);')

    this.addSql('alter table `game_activity` add constraint `game_activity_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;')
    this.addSql('alter table `game_activity` add constraint `game_activity_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade;')
  }

}
