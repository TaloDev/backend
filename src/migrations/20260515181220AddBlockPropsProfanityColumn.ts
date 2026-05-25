import { Migration } from '@mikro-orm/migrations'

export class AddBlockPropsProfanityColumn extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`game\` add \`block_props_profanity\` tinyint(1) not null default false;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`game\` drop column \`block_props_profanity\`;`)
  }
}
