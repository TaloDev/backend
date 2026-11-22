import { Migration } from '@mikro-orm/migrations'

export class AddPlayerClaimKey extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table \`player\` add \`claim_key\` varchar(255) null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`player\` drop column \`claim_key\`;`)
  }
}
