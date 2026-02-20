import { Migration } from '@mikro-orm/migrations'

export class AddPlayerGroupQueryIndexes extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table `player` add index `player_last_seen_at_index`(`last_seen_at`);')
    this.addSql('alter table `player` add index `player_created_at_index`(`created_at`);')

    this.addSql('alter table `player_prop` add index `player_prop_key_index`(`key`);')
    this.addSql('alter table `player_prop` add index `idx_playerprop_key_value`(`key`, `value`);')

    this.addSql(
      'alter table `leaderboard` add index `leaderboard_internal_name_index`(`internal_name`);',
    )

    this.addSql(
      'alter table `leaderboard_entry` add index `leaderboard_entry_hidden_index`(`hidden`);',
    )
    this.addSql(
      'alter table `leaderboard_entry` add index `idx_leaderboardentry_hidden_leaderboard_id_score`(`hidden`, `leaderboard_id`, `score`);',
    )

    this.addSql(
      'alter table `game_stat` add index `game_stat_internal_name_index`(`internal_name`);',
    )

    this.addSql(
      'alter table `player_game_stat` add index `idx_playergamestat_stat_id_value`(`stat_id`, `value`);',
    )

    this.addSql(
      'alter table `game_feedback_category` add index `game_feedback_category_internal_name_index`(`internal_name`);',
    )
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player` drop index `player_last_seen_at_index`;')
    this.addSql('alter table `player` drop index `player_created_at_index`;')

    this.addSql('alter table `player_prop` drop index `player_prop_key_index`;')
    this.addSql('alter table `player_prop` drop index `idx_playerprop_key_value`;')

    this.addSql('alter table `leaderboard` drop index `leaderboard_internal_name_index`;')

    this.addSql('alter table `leaderboard_entry` drop index `leaderboard_entry_hidden_index`;')
    this.addSql(
      'alter table `leaderboard_entry` drop index `idx_leaderboardentry_hidden_leaderboard_id_score`;',
    )

    this.addSql('alter table `game_stat` drop index `game_stat_internal_name_index`;')

    this.addSql('alter table `player_game_stat` drop index `idx_playergamestat_stat_id_value`;')

    this.addSql(
      'alter table `game_feedback_category` drop index `game_feedback_category_internal_name_index`;',
    )
  }
}
