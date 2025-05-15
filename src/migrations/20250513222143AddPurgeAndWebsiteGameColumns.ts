import { Migration } from '@mikro-orm/migrations'

export class AddPurgeAndWebsiteGameColumns extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `game` add `purge_dev_players` tinyint(1) not null default false, add `purge_live_players` tinyint(1) not null default false, add `website` varchar(255) null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game` drop column `purge_dev_players`, drop column `purge_live_players`, drop column `website`;')
  }

}
