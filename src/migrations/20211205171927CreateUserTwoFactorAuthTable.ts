import { Migration } from '@mikro-orm/migrations'

export class CreateUserTwoFactorAuthTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `user_two_factor_auth` (`id` int unsigned not null auto_increment primary key, `secret` varchar(255) not null, `enabled` tinyint(1) not null) default character set utf8mb4 engine = InnoDB;')

    this.addSql('alter table `user` add `two_factor_auth_id` int(11) unsigned null;')
    this.addSql('alter table `user` add index `user_two_factor_auth_id_index`(`two_factor_auth_id`);')
    this.addSql('alter table `user` add unique `user_two_factor_auth_id_unique`(`two_factor_auth_id`);')

    this.addSql('alter table `user` add constraint `user_two_factor_auth_id_foreign` foreign key (`two_factor_auth_id`) references `user_two_factor_auth` (`id`) on update cascade on delete set null;')
  }

}
