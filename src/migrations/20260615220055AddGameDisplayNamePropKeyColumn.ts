import { Migration } from '@mikro-orm/migrations'

export class AddGameDisplayNamePropKeyColumn extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table \`game\` add \`display_name_prop_key\` varchar(255) null;`)

    this.addSql(`alter table \`data_export\` modify \`entities\` text not null;`)

    this.addSql(`alter table \`apikey\` modify \`scopes\` text not null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`apikey\` modify \`scopes\` text not null;`)

    this.addSql(`alter table \`data_export\` modify \`entities\` text not null;`)

    this.addSql(`alter table \`game\` drop column \`display_name_prop_key\`;`)
  }
}
