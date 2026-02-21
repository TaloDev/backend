import { Migration } from '@mikro-orm/migrations'

export class AddPlayerDevBuildColumn extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table `player` add `dev_build` tinyint(1) not null default false;')
    this.addSql(
      "update `player` p inner join `player_prop` pp on pp.`player_id` = p.`id` set p.`dev_build` = true where pp.`key` = 'META_DEV_BUILD';",
    )
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player` drop column `dev_build`;')
  }
}
