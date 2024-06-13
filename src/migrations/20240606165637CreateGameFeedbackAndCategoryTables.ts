import { Migration } from '@mikro-orm/migrations'

export class CreateGameFeedbackAndCategoryTables extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `game_feedback_category` (`id` int unsigned not null auto_increment primary key, `internal_name` varchar(255) not null, `name` varchar(255) not null, `description` varchar(255) not null, `anonymised` tinyint(1) not null, `game_id` int unsigned not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_feedback_category` add index `game_feedback_category_game_id_index`(`game_id`);')

    this.addSql('create table `game_feedback` (`id` int unsigned not null auto_increment primary key, `category_id` int unsigned not null, `player_alias_id` int unsigned not null, `comment` text not null, `anonymised` tinyint(1) not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_feedback` add index `game_feedback_category_id_index`(`category_id`);')
    this.addSql('alter table `game_feedback` add index `game_feedback_player_alias_id_index`(`player_alias_id`);')

    this.addSql('alter table `game_feedback_category` add constraint `game_feedback_category_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;')

    this.addSql('alter table `game_feedback` add constraint `game_feedback_category_id_foreign` foreign key (`category_id`) references `game_feedback_category` (`id`) on delete cascade;')
    this.addSql('alter table `game_feedback` add constraint `game_feedback_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on delete cascade;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  async down(): Promise<void> {
    this.addSql('alter table `game_feedback` drop foreign key `game_feedback_category_id_foreign`;')

    this.addSql('drop table if exists `game_feedback_category`;')

    this.addSql('drop table if exists `game_feedback`;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

}
