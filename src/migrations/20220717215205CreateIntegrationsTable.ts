import { Migration } from '@mikro-orm/migrations'

export class CreateIntegrationsTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `integration` (`id` int unsigned not null auto_increment primary key, `type` enum(\'steamworks\') not null, `game_id` int unsigned not null, `config` json not null, `deleted_at` datetime null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `integration` add index `integration_game_id_index`(`game_id`);')

    this.addSql('alter table `integration` add constraint `integration_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `integration`;')
  }

}
