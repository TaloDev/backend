import { Migration } from '@mikro-orm/migrations'

export class DeletePlayerAliasAnonymisedColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_alias` drop foreign key `player_alias_player_id_foreign`;')

    this.addSql('alter table `player_alias` drop column `anonymised`;')

    this.addSql('alter table `player_alias` modify `player_id` varchar(255) not null;')
    this.addSql('alter table `player_alias` add constraint `player_alias_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_alias` drop foreign key `player_alias_player_id_foreign`;')

    this.addSql('alter table `player_alias` add `anonymised` tinyint(1) not null default false;')
    this.addSql('alter table `player_alias` modify `player_id` varchar(255) null;')
    this.addSql('alter table `player_alias` add constraint `player_alias_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on delete cascade;')
  }

}
