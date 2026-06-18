import { Migration } from '@mikro-orm/migrations'

export class AddGameLogoUrlColumn extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table \`game\` add \`logo_url\` varchar(255) null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`game\` drop column \`logo_url\`;`)
  }
}
