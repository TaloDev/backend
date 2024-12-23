import { Migration } from '@mikro-orm/migrations'

export class IncreasePlayerAliasIdentifierLength extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_alias` modify `identifier` varchar(1024) not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` modify `identifier` varchar(255) not null;')
  }

}
