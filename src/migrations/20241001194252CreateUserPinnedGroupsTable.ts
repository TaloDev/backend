import { Migration } from '@mikro-orm/migrations'

export class CreateUserPinnedGroupsTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `user_pinned_group` (`id` int unsigned not null auto_increment primary key, `user_id` int unsigned not null, `group_id` varchar(255) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `user_pinned_group` add index `user_pinned_group_user_id_index`(`user_id`);')
    this.addSql('alter table `user_pinned_group` add index `user_pinned_group_group_id_index`(`group_id`);')
    this.addSql('alter table `user_pinned_group` add unique `user_pinned_group_user_id_group_id_unique`(`user_id`, `group_id`);')

    this.addSql('alter table `user_pinned_group` add constraint `user_pinned_group_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade;')
    this.addSql('alter table `user_pinned_group` add constraint `user_pinned_group_group_id_foreign` foreign key (`group_id`) references `player_group` (`id`) on update cascade;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `user_pinned_group`;')
  }

}
