import { Migration } from '@mikro-orm/migrations'

export class CascadeDeletePlayerAliasEvents extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `event` modify `player_alias_id` int(11) unsigned null;')

    this.addSql('alter table `event` drop foreign key `event_player_alias_id_foreign`;')
    this.addSql('alter table `event` add constraint `event_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on delete cascade;')
  }

}
