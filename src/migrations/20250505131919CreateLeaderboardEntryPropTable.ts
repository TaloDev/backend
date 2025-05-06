import { Migration } from '@mikro-orm/migrations'

export class CreateLeaderboardEntryPropTable extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      create table \`leaderboard_entry_prop\` (
        \`id\` int unsigned not null auto_increment primary key,
        \`leaderboard_entry_id\` int unsigned not null,
        \`key\` varchar(128) not null,
        \`value\` varchar(512) not null,
        \`created_at\` datetime not null
      ) default character set utf8mb4 engine = InnoDB;
    `)

    this.addSql(`
      alter table \`leaderboard_entry_prop\`
      add index \`leaderboard_entry_prop_entry_id_index\`(\`leaderboard_entry_id\`);
    `)

    this.addSql(`
      alter table \`leaderboard_entry_prop\`
      add constraint \`leaderboard_entry_prop_entry_id_foreign\`
      foreign key (\`leaderboard_entry_id\`) references \`leaderboard_entry\` (\`id\`)
      on update cascade;
    `)

    // migrate data from leaderboard_entry.props JSON to leaderboard_entry_prop rows
    this.addSql(`
      INSERT INTO leaderboard_entry_prop (leaderboard_entry_id, \`key\`, \`value\`, created_at)
      SELECT
        le.id,
        jt.prop_key,
        jt.prop_value,
        NOW()
      FROM leaderboard_entry le,
      JSON_TABLE(
        le.props,
        '$[*]' COLUMNS (
          prop_key VARCHAR(128) PATH '$.key',
          prop_value VARCHAR(512) PATH '$.value'
        )
      ) AS jt;
    `)

    this.addSql('alter table `leaderboard_entry` drop column `props`;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `leaderboard_entry` add `props` json not null;')

    this.addSql('drop table if exists `leaderboard_entry_prop`;')
  }

}
