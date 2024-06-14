import { Migration } from '@mikro-orm/migrations'

export class AddAPIKeyUpdatedAtColumn extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `apikey` add `updated_at` datetime null;')
  }

  async down(): Promise<void> {
    this.addSql('alter table `apikey` drop column `updated_at`;')
  }

}
