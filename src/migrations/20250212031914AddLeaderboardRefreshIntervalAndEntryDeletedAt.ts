import { Migration } from '@mikro-orm/migrations'

export class AddLeaderboardRefreshIntervalAndEntryDeletedAt extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `leaderboard` add `refresh_interval` enum(\'never\', \'daily\', \'weekly\', \'monthly\', \'yearly\') not null default \'never\';')

    this.addSql('alter table `leaderboard_entry` add `deleted_at` datetime null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `leaderboard` drop column `refresh_interval`;')

    this.addSql('alter table `leaderboard_entry` drop column `deleted_at`;')
  }

}
