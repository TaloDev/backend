import { Migration } from '@mikro-orm/migrations'

export class CreateGameSavesTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `game_save` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `content` json not null, `player_id` varchar(255) null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_save` add index `game_save_player_id_index`(`player_id`);')

    this.addSql('alter table `game_save` add constraint `game_save_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on delete cascade;')
  }

}
