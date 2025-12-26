import { Migration } from '@mikro-orm/migrations'

export class CreateInvitesTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `invite` (`id` int unsigned not null auto_increment primary key, `token` varchar(255) not null, `email` varchar(255) not null, `type` tinyint not null, `organisation_id` int unsigned not null, `invited_by_user_id` int unsigned not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `invite` add index `invite_organisation_id_index`(`organisation_id`);')
    this.addSql('alter table `invite` add index `invite_invited_by_user_id_index`(`invited_by_user_id`);')

    this.addSql('alter table `invite` add constraint `invite_organisation_id_foreign` foreign key (`organisation_id`) references `organisation` (`id`) on update cascade;')
    this.addSql('alter table `invite` add constraint `invite_invited_by_user_id_foreign` foreign key (`invited_by_user_id`) references `user` (`id`) on update cascade;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `invite`;')
  }

}
