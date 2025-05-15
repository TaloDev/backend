import { Migration } from '@mikro-orm/migrations'

export class AddCascadeDeleteRules extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_prop` drop foreign key `player_prop_player_id_foreign`;')

    this.addSql('alter table `player_auth_activity` drop foreign key `player_auth_activity_player_id_foreign`;')

    this.addSql('alter table `player_alias` drop foreign key `player_alias_player_id_foreign`;')

    this.addSql('alter table `player_presence` drop foreign key `player_presence_player_alias_id_foreign`;')

    this.addSql('alter table `game_save` drop foreign key `game_save_player_id_foreign`;')

    this.addSql('alter table `leaderboard_entry` drop foreign key `leaderboard_entry_leaderboard_id_foreign`;')
    this.addSql('alter table `leaderboard_entry` drop foreign key `leaderboard_entry_player_alias_id_foreign`;')

    this.addSql('alter table `leaderboard_entry_prop` drop foreign key `leaderboard_entry_prop_entry_id_foreign`;')

    this.addSql('alter table `player_game_stat` drop foreign key `player_game_stat_player_id_foreign`;')
    this.addSql('alter table `player_game_stat` drop foreign key `player_game_stat_stat_id_foreign`;')

    this.addSql('alter table `game_feedback` drop foreign key `game_feedback_category_id_foreign`;')
    this.addSql('alter table `game_feedback` drop foreign key `game_feedback_player_alias_id_foreign`;')

    this.addSql('alter table `steamworks_leaderboard_mapping` drop foreign key `steamworks_leaderboard_mapping_leaderboard_id_foreign`;')

    this.addSql('alter table `player_prop` add constraint `player_prop_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `player_auth_activity` add constraint `player_auth_activity_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `player_alias` add constraint `player_alias_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `player_presence` modify `player_alias_id` int unsigned not null;')
    this.addSql('alter table `player_presence` add constraint `player_presence_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `game_save` add constraint `game_save_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `leaderboard_entry` modify `leaderboard_id` int unsigned not null, modify `player_alias_id` int unsigned not null;')
    this.addSql('alter table `leaderboard_entry` add constraint `leaderboard_entry_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `leaderboard_entry` add constraint `leaderboard_entry_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `leaderboard_entry_prop` add constraint `leaderboard_entry_prop_leaderboard_entry_id_foreign` foreign key (`leaderboard_entry_id`) references `leaderboard_entry` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `player_game_stat` modify `player_id` varchar(255) not null, modify `stat_id` int unsigned not null;')
    this.addSql('alter table `player_game_stat` add constraint `player_game_stat_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `player_game_stat` add constraint `player_game_stat_stat_id_foreign` foreign key (`stat_id`) references `game_stat` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `game_feedback` add constraint `game_feedback_category_id_foreign` foreign key (`category_id`) references `game_feedback_category` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `game_feedback` add constraint `game_feedback_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `steamworks_leaderboard_mapping` add constraint `steamworks_leaderboard_mapping_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on update cascade on delete cascade;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_prop` drop foreign key `player_prop_player_id_foreign`;')

    this.addSql('alter table `player_auth_activity` drop foreign key `player_auth_activity_player_id_foreign`;')

    this.addSql('alter table `player_alias` drop foreign key `player_alias_player_id_foreign`;')

    this.addSql('alter table `player_presence` drop foreign key `player_presence_player_alias_id_foreign`;')

    this.addSql('alter table `game_save` drop foreign key `game_save_player_id_foreign`;')

    this.addSql('alter table `leaderboard_entry` drop foreign key `leaderboard_entry_leaderboard_id_foreign`;')
    this.addSql('alter table `leaderboard_entry` drop foreign key `leaderboard_entry_player_alias_id_foreign`;')

    this.addSql('alter table `leaderboard_entry_prop` drop foreign key `leaderboard_entry_prop_leaderboard_entry_id_foreign`;')

    this.addSql('alter table `player_game_stat` drop foreign key `player_game_stat_player_id_foreign`;')
    this.addSql('alter table `player_game_stat` drop foreign key `player_game_stat_stat_id_foreign`;')

    this.addSql('alter table `game_feedback` drop foreign key `game_feedback_category_id_foreign`;')
    this.addSql('alter table `game_feedback` drop foreign key `game_feedback_player_alias_id_foreign`;')

    this.addSql('alter table `steamworks_leaderboard_mapping` drop foreign key `steamworks_leaderboard_mapping_leaderboard_id_foreign`;')

    this.addSql('alter table `player_prop` add constraint `player_prop_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')

    this.addSql('alter table `player_auth_activity` add constraint `player_auth_activity_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')

    this.addSql('alter table `player_alias` add constraint `player_alias_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')

    this.addSql('alter table `player_presence` modify `player_alias_id` int unsigned null;')
    this.addSql('alter table `player_presence` add constraint `player_presence_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on delete cascade;')

    this.addSql('alter table `game_save` add constraint `game_save_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')

    this.addSql('alter table `leaderboard_entry` modify `leaderboard_id` int unsigned null, modify `player_alias_id` int unsigned null;')
    this.addSql('alter table `leaderboard_entry` add constraint `leaderboard_entry_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on delete cascade;')
    this.addSql('alter table `leaderboard_entry` add constraint `leaderboard_entry_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on delete cascade;')

    this.addSql('alter table `leaderboard_entry_prop` add constraint `leaderboard_entry_prop_leaderboard_entry_id_foreign` foreign key (`leaderboard_entry_id`) references `leaderboard_entry` (`id`) on update cascade;')

    this.addSql('alter table `player_game_stat` modify `player_id` varchar(255) null, modify `stat_id` int unsigned null;')
    this.addSql('alter table `player_game_stat` add constraint `player_game_stat_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on delete cascade;')
    this.addSql('alter table `player_game_stat` add constraint `player_game_stat_stat_id_foreign` foreign key (`stat_id`) references `game_stat` (`id`) on delete cascade;')

    this.addSql('alter table `game_feedback` add constraint `game_feedback_category_id_foreign` foreign key (`category_id`) references `game_feedback_category` (`id`) on delete cascade;')
    this.addSql('alter table `game_feedback` add constraint `game_feedback_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on delete cascade;')

    this.addSql('alter table `steamworks_leaderboard_mapping` add constraint `steamworks_leaderboard_mapping_leaderboard_id_foreign` foreign key (`leaderboard_id`) references `leaderboard` (`id`) on delete cascade;')
  }

}
