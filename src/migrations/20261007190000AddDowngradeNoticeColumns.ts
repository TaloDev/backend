import { Migration } from '@mikro-orm/migrations'

export class AddDowngradeNoticeColumns extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`organisation_pricing_plan\` add \`downgrade_notice_sent_at\` datetime null;`,
    )

    this.addSql(
      `alter table \`organisation_pricing_plan\` add \`downgrade_reminder_sent_at\` datetime null;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`organisation_pricing_plan\` drop column \`downgrade_reminder_sent_at\`;`,
    )

    this.addSql(
      `alter table \`organisation_pricing_plan\` drop column \`downgrade_notice_sent_at\`;`,
    )
  }
}
