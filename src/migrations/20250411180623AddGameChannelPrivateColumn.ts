import { Migration } from '@mikro-orm/migrations'

export class AddGameChannelPrivateColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `game_channel` add `private` tinyint(1) not null default false;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_channel` drop column `private`;')
  }

}
