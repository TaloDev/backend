import { Migration } from '@mikro-orm/migrations'

export class AddLastUsageWarningThresholdColumn extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table \`organisation_pricing_plan\` add \`last_usage_warning_threshold\` int null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table \`organisation_pricing_plan\` drop column \`last_usage_warning_threshold\`;`,
    )
  }
}
