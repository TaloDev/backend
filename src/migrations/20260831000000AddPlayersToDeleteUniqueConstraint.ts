import { Migration } from '@mikro-orm/migrations'

export class AddPlayersToDeleteUniqueConstraint extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table `players_to_delete` drop index `players_to_delete_player_id_index`, add unique `players_to_delete_player_id_unique`(`player_id`);',
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `players_to_delete` drop index `players_to_delete_player_id_unique`, add index `players_to_delete_player_id_index`(`player_id`);',
    )
  }
}
