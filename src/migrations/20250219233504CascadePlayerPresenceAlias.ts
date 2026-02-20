import { Migration } from '@mikro-orm/migrations'

export class CascadePlayerPresenceAlias extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table `player_presence` drop foreign key `player_presence_player_alias_id_foreign`;',
    )

    this.addSql('alter table `player_presence` modify `player_alias_id` int unsigned null;')
    this.addSql(
      'alter table `player_presence` add constraint `player_presence_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on delete cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `player_presence` drop foreign key `player_presence_player_alias_id_foreign`;',
    )

    this.addSql('alter table `player_presence` modify `player_alias_id` int unsigned not null;')
    this.addSql(
      'alter table `player_presence` add constraint `player_presence_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade;',
    )
  }
}
