import { Migration } from '@mikro-orm/migrations'

export class CreateUserRecoveryCodeTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `user_recovery_code` (`id` int unsigned not null auto_increment primary key, `user_id` int(11) unsigned not null, `code` varchar(255) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `user_recovery_code` add index `user_recovery_code_user_id_index`(`user_id`);')

    this.addSql('alter table `user_recovery_code` add constraint `user_recovery_code_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on delete cascade;')
  }

}
