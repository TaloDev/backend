import { Migration } from '@mikro-orm/migrations'

export class UpdateTableDefaultValues extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `game_save` drop foreign key `game_save_player_id_foreign`;')

    this.addSql('alter table `organisation_pricing_plan` modify `status` varchar(255) not null default \'active\';')

    this.addSql('alter table `player_group` modify `rule_mode` enum(\'$and\', \'$or\') not null default \'$and\';')

    this.addSql('alter table `game_save` modify `player_id` varchar(255) not null;')
    this.addSql('alter table `game_save` add constraint `game_save_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')

    this.addSql('alter table `leaderboard` modify `sort_mode` enum(\'desc\', \'asc\') not null default \'desc\';')

    this.addSql('alter table `user` modify `type` tinyint not null default 2;')

    this.addSql('alter table `invite` modify `type` tinyint not null default 2;')

    this.addSql('alter table `data_export` modify `status` tinyint not null default 0;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  async down(): Promise<void> {
    this.addSql('alter table `game_save` drop foreign key `game_save_player_id_foreign`;')

    this.addSql('alter table `organisation_pricing_plan` modify `status` varchar(255) not null;')

    this.addSql('alter table `player_group` modify `rule_mode` enum(\'$and\', \'$or\') not null;')

    this.addSql('alter table `game_save` modify `player_id` varchar(255) null;')
    this.addSql('alter table `game_save` add constraint `game_save_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on delete cascade;')

    this.addSql('alter table `leaderboard` modify `sort_mode` enum(\'desc\', \'asc\') not null;')

    this.addSql('alter table `user` modify `type` tinyint not null;')

    this.addSql('alter table `invite` modify `type` tinyint not null;')

    this.addSql('alter table `data_export` modify `status` tinyint not null;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

}
