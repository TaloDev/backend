import { Migration } from '@mikro-orm/migrations'

export class AddPlayerGroupMembersVisibleColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_group` add `members_visible` tinyint(1) not null default false;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_group` drop column `members_visible`;')
  }

}
