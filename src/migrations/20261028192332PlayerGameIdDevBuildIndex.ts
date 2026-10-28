import { Migration } from '@mikro-orm/migrations'

export class PlayerGameIdDevBuildIndex extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`player\` add index \`player_game_id_dev_build_index\` (\`game_id\`, \`dev_build\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`player\` drop index \`player_game_id_dev_build_index\`;`)
  }
}
