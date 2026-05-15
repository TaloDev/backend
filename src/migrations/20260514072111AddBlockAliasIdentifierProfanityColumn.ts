import { Migration } from '@mikro-orm/migrations'

export class AddBlockAliasIdentifierProfanityColumn extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table \`game\` add \`block_alias_identifier_profanity\` tinyint(1) not null default false;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`game\` drop column \`block_alias_identifier_profanity\`;`)
  }
}
