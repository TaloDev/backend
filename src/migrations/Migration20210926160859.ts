import { Migration } from '@mikro-orm/migrations';

export class Migration20210926160859 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `data_export` (`id` int unsigned not null auto_increment primary key, `created_by_user_id` int(11) unsigned not null, `game_id` int(11) unsigned not null, `entities` text not null, `status` tinyint not null, `failed_at` datetime null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;');
    this.addSql('alter table `data_export` add index `data_export_created_by_user_id_index`(`created_by_user_id`);');
    this.addSql('alter table `data_export` add index `data_export_game_id_index`(`game_id`);');

    this.addSql('alter table `data_export` add constraint `data_export_created_by_user_id_foreign` foreign key (`created_by_user_id`) references `user` (`id`) on update cascade;');
    this.addSql('alter table `data_export` add constraint `data_export_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade;');
  }

}
