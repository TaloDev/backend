import { Migration } from '@mikro-orm/migrations'

export class InternalNameGameIndexes extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `leaderboard` drop index `leaderboard_internal_name_index`;')

    this.addSql('alter table `leaderboard` add index `leaderboard_game_id_internal_name_index`(`game_id`, `internal_name`);')

    this.addSql('alter table `game_stat` drop index `game_stat_internal_name_index`;')

    this.addSql('alter table `game_stat` add index `game_stat_game_id_internal_name_index`(`game_id`, `internal_name`);')

    this.addSql('alter table `game_feedback_category` drop index `game_feedback_category_internal_name_index`;')

    this.addSql('alter table `game_feedback_category` add index `game_feedback_category_game_id_internal_name_index`(`game_id`, `internal_name`);')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `leaderboard` drop index `leaderboard_game_id_internal_name_index`;')

    this.addSql('alter table `leaderboard` add index `leaderboard_internal_name_index`(`internal_name`);')

    this.addSql('alter table `game_stat` drop index `game_stat_game_id_internal_name_index`;')

    this.addSql('alter table `game_stat` add index `game_stat_internal_name_index`(`internal_name`);')

    this.addSql('alter table `game_feedback_category` drop index `game_feedback_category_game_id_internal_name_index`;')

    this.addSql('alter table `game_feedback_category` add index `game_feedback_category_internal_name_index`(`internal_name`);')
  }

}
