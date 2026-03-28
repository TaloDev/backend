import { Migration } from '@mikro-orm/migrations'

export class AddFailedJobFailedAtIndex extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table \`failed_job\` add index \`failed_job_failed_at_index\`(\`failed_at\`);`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`failed_job\` drop index \`failed_job_failed_at_index\`;`)
  }
}
