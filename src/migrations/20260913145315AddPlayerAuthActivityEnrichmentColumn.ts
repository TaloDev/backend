import { Migration } from '@mikro-orm/migrations'

export class AddPlayerAuthActivityEnrichmentColumn extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`game\` add \`player_auth_activity_enrichment\` tinyint(1) not null default false;`,
    )

    // only opt-in going forward
    this.addSql(`update \`game\` set \`player_auth_activity_enrichment\` = true;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`game\` drop column \`player_auth_activity_enrichment\`;`)
  }
}
