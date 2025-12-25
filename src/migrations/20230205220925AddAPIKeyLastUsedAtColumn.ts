import { Migration } from '@mikro-orm/migrations'

export class AddAPIKeyLastUsedAtColumn extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `apikey` add `last_used_at` datetime null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `apikey` drop `last_used_at`;')
  }

}
