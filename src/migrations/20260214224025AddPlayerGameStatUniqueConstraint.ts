import { Migration } from '@mikro-orm/migrations'

export class AddPlayerGameStatUniqueConstraint extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table `player_game_stat` add unique `player_game_stat_player_id_stat_id_unique`(`player_id`, `stat_id`);',
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `player_game_stat` drop index `player_game_stat_player_id_stat_id_unique`;',
    )
  }
}
