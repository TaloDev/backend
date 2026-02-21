import { Migration } from '@mikro-orm/migrations'

export class AddLeaderboardEntryHiddenColumn extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `leaderboard_entry` add `hidden` tinyint(1) not null default false;')
  }
}
