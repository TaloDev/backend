import { Migration } from '@mikro-orm/migrations'

export class AddLeaderboardEntryPropsColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `leaderboard_entry` add `props` json not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `leaderboard_entry` drop column `props`;')
  }

}
