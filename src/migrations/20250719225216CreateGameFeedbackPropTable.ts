import { Migration } from '@mikro-orm/migrations'

export class CreateGameFeedbackPropTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `game_feedback_prop` (`id` int unsigned not null auto_increment primary key, `game_feedback_id` int unsigned not null, `key` varchar(128) not null, `value` varchar(512) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_feedback_prop` add index `game_feedback_prop_game_feedback_id_index`(`game_feedback_id`);')

    this.addSql('alter table `game_feedback_prop` add constraint `game_feedback_prop_game_feedback_id_foreign` foreign key (`game_feedback_id`) references `game_feedback` (`id`) on update cascade on delete cascade;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `game_feedback_prop`;')
  }

}
