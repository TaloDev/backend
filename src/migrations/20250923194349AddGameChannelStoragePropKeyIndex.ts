import { Migration } from '@mikro-orm/migrations'

export class AddGameChannelStoragePropKeyIndex extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `game_channel_storage_prop` add index `game_channel_storage_prop_game_channel_id_key_index`(`game_channel_id`, `key`);')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_channel_storage_prop` drop index `game_channel_storage_prop_game_channel_id_key_index`;')
  }

}
