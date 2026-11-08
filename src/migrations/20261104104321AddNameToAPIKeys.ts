import { Migration } from '@mikro-orm/migrations'

export class AddNameToAPIKeys extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table \`apikey\` add \`name\` varchar(255) not null default '';`)

    this.addSql(`alter table \`admin_apikey\` add \`name\` varchar(255) not null default '';`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`admin_apikey\` drop column \`name\`;`)

    this.addSql(`alter table \`apikey\` drop column \`name\`;`)
  }
}
