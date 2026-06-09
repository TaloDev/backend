import { Migration } from '@mikro-orm/migrations'

export class AddVerifyRequestsColumn extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table \`game\` add \`verify_requests\` tinyint(1) not null default false;`)

    this.addSql(`alter table \`data_export\` modify \`entities\` text not null;`)

    this.addSql(`alter table \`apikey\` modify \`scopes\` text not null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`apikey\` modify \`scopes\` text not null;`)

    this.addSql(`alter table \`data_export\` modify \`entities\` text not null;`)

    this.addSql(`alter table \`game\` drop column \`verify_requests\`;`)
  }
}
