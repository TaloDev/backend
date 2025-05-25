import { Migration } from '@mikro-orm/migrations'

export class AddGameChannelTemporaryMembershipColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `game_channel` add `temporary_membership` tinyint(1) not null default false;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_channel` drop column `temporary_membership`;')
  }

}
