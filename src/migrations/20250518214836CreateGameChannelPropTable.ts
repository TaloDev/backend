import { Migration } from '@mikro-orm/migrations'

export class CreateGameChannelPropTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `game_channel_prop` (`id` int unsigned not null auto_increment primary key, `game_channel_id` int unsigned not null, `key` varchar(128) not null, `value` varchar(512) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `game_channel_prop` add index `game_channel_prop_game_channel_id_index`(`game_channel_id`);')

    this.addSql('alter table `game_channel_prop` add constraint `game_channel_prop_game_channel_id_foreign` foreign key (`game_channel_id`) references `game_channel` (`id`) on update cascade on delete cascade;')

    // migrate data from game_channel.props JSON to game_channel_prop rows
    this.addSql(`
      INSERT INTO game_channel_prop (game_channel_id, \`key\`, \`value\`, created_at)
      SELECT
        gc.id,
        jt.prop_key,
        jt.prop_value,
        NOW()
      FROM game_channel gc,
      JSON_TABLE(
        gc.props,
        '$[*]' COLUMNS (
          prop_key VARCHAR(128) PATH '$.key',
          prop_value VARCHAR(512) PATH '$.value'
        )
      ) AS jt
      WHERE jt.prop_value IS NOT NULL;
    `)

    this.addSql('alter table `game_channel` drop column `props`;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `game_channel_prop`;')

    this.addSql('alter table `game_channel` add `props` json not null;')
  }

}
