import { Migration } from '@mikro-orm/migrations'

export class AddFailedJobStackColumn extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `failed_job` add `stack` text not null;')
  }

  async down(): Promise<void> {
    this.addSql('alter table `failed_job` drop `stack`;')
  }

}
