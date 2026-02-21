import { Migration } from '@mikro-orm/migrations'

export class MakeGameActivityUserNullable extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `game_activity` drop foreign key `game_activity_game_id_foreign`;')

    this.addSql('alter table `user` drop index `user_two_factor_auth_id_index`;')

    this.addSql('alter table `game_activity` modify `game_id` int unsigned null;')
    this.addSql(
      'alter table `game_activity` add constraint `game_activity_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade on delete set null;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game_activity` drop foreign key `game_activity_game_id_foreign`;')

    this.addSql(
      'alter table `user` add index `user_two_factor_auth_id_index`(`two_factor_auth_id`);',
    )

    this.addSql('alter table `game_activity` modify `game_id` int unsigned not null;')
    this.addSql(
      'alter table `game_activity` add constraint `game_activity_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;',
    )
  }
}
