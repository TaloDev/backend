import { Migration } from '@mikro-orm/migrations'

export class CreateGameSecretsTable extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `game_secret` (`id` int unsigned not null auto_increment primary key, `secret` varchar(255) not null) default character set utf8mb4 engine = InnoDB;',
    )

    this.addSql('alter table `game` add `api_secret_id` int unsigned not null;')
    this.addSql(
      'alter table `game` add constraint `game_api_secret_id_foreign` foreign key (`api_secret_id`) references `game_secret` (`id`) on update cascade;',
    )
    this.addSql('alter table `game` add unique `game_api_secret_id_unique`(`api_secret_id`);')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `game` drop foreign key `game_api_secret_id_foreign`;')

    this.addSql('drop table if exists `game_secret`;')

    this.addSql('alter table `game` drop index `game_api_secret_id_unique`;')
    this.addSql('alter table `game` drop `api_secret_id`;')
  }
}
