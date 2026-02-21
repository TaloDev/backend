import { Migration } from '@mikro-orm/migrations'

export class AddPlayerAliasAnonymisedColumn extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table `player_alias` add `anonymised` tinyint(1) not null default false;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` drop column `anonymised`;')
  }
}
