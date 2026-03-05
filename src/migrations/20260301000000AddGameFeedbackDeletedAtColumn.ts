import { Migration } from '@mikro-orm/migrations'

export class AddGameFeedbackDeletedAtColumn extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table `game_feedback` add `deleted_at` datetime null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_feedback` drop column `deleted_at`;')
  }
}
