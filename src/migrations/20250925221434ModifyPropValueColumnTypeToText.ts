import { Migration } from '@mikro-orm/migrations'

export class ModifyPropValueColumnTypeToText extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_prop` drop index `idx_playerprop_key_value`;')

    this.addSql('alter table `player_prop` modify `value` text not null;')

    this.addSql('alter table `leaderboard_entry_prop` modify `value` text not null;')

    this.addSql('alter table `game_feedback_prop` modify `value` text not null;')

    this.addSql('alter table `game_channel_storage_prop` modify `value` text not null;')

    this.addSql('alter table `game_channel_prop` modify `value` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_prop` modify `value` varchar(512) not null;')

    this.addSql('alter table `leaderboard_entry_prop` modify `value` varchar(512) not null;')

    this.addSql('alter table `game_feedback_prop` modify `value` varchar(512) not null;')

    this.addSql('alter table `game_channel_storage_prop` modify `value` varchar(512) not null;')

    this.addSql('alter table `game_channel_prop` modify `value` varchar(512) not null;')

    this.addSql('alter table `player_prop` add index `idx_playerprop_key_value`(`key`, `value`);')
  }

}
