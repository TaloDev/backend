import { Migration } from '@mikro-orm/migrations'

export class AddGameSwitcherPreferences extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`game\` add \`switcher_order\` int not null default 0, add \`switcher_hidden\` tinyint(1) not null default false;`,
    )

    // id order is the order games were shown in before this migration
    this.addSql(`update \`game\` set \`switcher_order\` = \`id\`;`)
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`game\` drop column \`switcher_order\`, drop column \`switcher_hidden\`;`,
    )
  }
}
