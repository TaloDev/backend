import { Migration } from '@mikro-orm/migrations'

export class PlayerAliasServiceUseEnum extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `player_alias` modify `service` enum('steam', 'epic', 'username', 'email', 'custom') not null;",
    )
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` modify `service` varchar(255) not null;')
  }
}
