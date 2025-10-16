import { Migration } from '@mikro-orm/migrations'

export class AddLeaderboardUniqueByPropsColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `leaderboard` add `unique_by_props` tinyint(1) not null default false;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `leaderboard` drop column `unique_by_props`;')
  }

}
