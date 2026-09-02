import { Migration } from '@mikro-orm/migrations'

export class CreateOrganisationMemberTable extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      'create table `organisation_member` (`id` int unsigned not null auto_increment primary key, `user_id` int unsigned not null, `organisation_id` int unsigned not null, `type` tinyint not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `organisation_member` add index `organisation_member_user_id_index`(`user_id`);',
    )
    this.addSql(
      'alter table `organisation_member` add index `organisation_member_organisation_id_index`(`organisation_id`);',
    )
    this.addSql(
      'alter table `organisation_member` add unique `organisation_member_user_id_organisation_id_unique`(`user_id`, `organisation_id`);',
    )
    this.addSql(
      'alter table `organisation_member` add constraint `organisation_member_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on delete cascade;',
    )
    this.addSql(
      'alter table `organisation_member` add constraint `organisation_member_organisation_id_foreign` foreign key (`organisation_id`) references `organisation` (`id`) on delete cascade;',
    )
    this.addSql(
      'insert into `organisation_member` (`user_id`, `organisation_id`, `type`, `created_at`) select `id`, `organisation_id`, `type`, `created_at` from `user`;',
    )
  }

  override down(): void | Promise<void> {
    this.addSql('drop table if exists `organisation_member`;')
  }
}
