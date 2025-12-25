import { Migration } from '@mikro-orm/migrations'

export class CreatePlayerAuthTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `player_auth` (`id` int unsigned not null auto_increment primary key, `password` varchar(255) not null, `email` varchar(255) null, `verification_enabled` tinyint(1) not null default false, `session_key` varchar(255) null, `session_created_at` datetime null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')

    this.addSql('alter table `player` add `auth_id` int unsigned null;')
    this.addSql('alter table `player` add constraint `player_auth_id_foreign` foreign key (`auth_id`) references `player_auth` (`id`) on update cascade on delete set null;')
    this.addSql('alter table `player` add unique `player_auth_id_unique`(`auth_id`);')

    this.addSql('alter table `player_alias` modify `service` enum(\'steam\', \'epic\', \'username\', \'email\', \'custom\', \'talo\') not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player` drop foreign key `player_auth_id_foreign`;')

    this.addSql('drop table if exists `player_auth`;')

    this.addSql('alter table `player` drop index `player_auth_id_unique`;')
    this.addSql('alter table `player` drop column `auth_id`;')

    this.addSql('alter table `player_alias` modify `service` enum(\'steam\', \'epic\', \'username\', \'email\', \'custom\') not null;')
  }

}
