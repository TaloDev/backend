import { Migration } from '@mikro-orm/migrations'

export class PlayerAliasIdentifierServiceIndex extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_alias` add index `idx_player_alias_service_identifier`(`service`(191), `identifier`(191));')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` drop index `idx_player_alias_service_identifier`;')
  }

}
