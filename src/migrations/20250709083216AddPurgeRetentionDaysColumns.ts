import { Migration } from '@mikro-orm/migrations'

export class AddPurgeRetentionDaysColumns extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `game` add `purge_dev_players_retention` int not null default 60, add `purge_live_players_retention` int not null default 90;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game` drop column `purge_dev_players_retention`, drop column `purge_live_players_retention`;')
  }

}
