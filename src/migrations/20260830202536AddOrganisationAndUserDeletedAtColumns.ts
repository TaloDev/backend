import { Migration } from '@mikro-orm/migrations'

export class AddOrganisationAndUserDeletedAtColumns extends Migration {
  override name = 'AddOrganisationAndUserDeletedAtColumns'

  override up(): void | Promise<void> {
    this.addSql(`alter table \`organisation\` add \`deleted_at\` datetime null;`)

    this.addSql(`alter table \`user\` add \`deleted_at\` datetime null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`organisation\` drop column \`deleted_at\`;`)

    this.addSql(`alter table \`user\` drop column \`deleted_at\`;`)
  }
}
