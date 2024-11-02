import { Migration } from '@mikro-orm/migrations'

export class AddPlayerAliasLastSeenAtColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_alias` add `last_seen_at` datetime not null default CURRENT_TIMESTAMP;')
    this.addSql('update `player_alias` set `last_seen_at` = `updated_at`;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` drop column `last_seen_at`;')
  }

}
