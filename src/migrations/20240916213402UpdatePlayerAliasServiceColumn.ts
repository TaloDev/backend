import { Migration } from '@mikro-orm/migrations'

export class UpdatePlayerAliasServiceColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_alias` modify `service` varchar(255) not null;')

    this.addSql('alter table `data_export` modify `entities` text not null;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` modify `service` enum(\'steam\', \'epic\', \'username\', \'email\', \'custom\', \'talo\') not null;')

    this.addSql('alter table `data_export` modify `entities` text not null;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

}
