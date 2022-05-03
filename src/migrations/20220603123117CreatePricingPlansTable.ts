import { Migration } from '@mikro-orm/migrations'

export class CreatePricingPlansTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `pricing_plan` (`id` int unsigned not null auto_increment primary key, `stripe_id` varchar(255) not null, `hidden` tinyint(1) not null default false, `default` tinyint(1) not null default false, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')

    this.addSql('create table `pricing_plan_action` (`id` int unsigned not null auto_increment primary key, `pricing_plan_id` int unsigned not null, `type` tinyint not null, `limit` int not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `pricing_plan_action` add index `pricing_plan_action_pricing_plan_id_index`(`pricing_plan_id`);')

    this.addSql('create table `organisation_pricing_plan` (`id` int unsigned not null auto_increment primary key, `pricing_plan_id` int unsigned not null, `status` varchar(255) not null, `stripe_price_id` varchar(255) null, `stripe_customer_id` varchar(255) null, `end_date` datetime null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `organisation_pricing_plan` add index `organisation_pricing_plan_pricing_plan_id_index`(`pricing_plan_id`);')

    this.addSql('create table `organisation_pricing_plan_action` (`id` int unsigned not null auto_increment primary key, `organisation_pricing_plan_id` int unsigned not null, `type` tinyint not null, `extra` json not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `organisation_pricing_plan_action` add index `organisation_pricing_plan_action_organisation_prici_03129_index`(`organisation_pricing_plan_id`);')

    this.addSql('alter table `pricing_plan_action` add constraint `pricing_plan_action_pricing_plan_id_foreign` foreign key (`pricing_plan_id`) references `pricing_plan` (`id`) on update cascade;')

    this.addSql('alter table `organisation_pricing_plan` add constraint `organisation_pricing_plan_pricing_plan_id_foreign` foreign key (`pricing_plan_id`) references `pricing_plan` (`id`) on update cascade;')

    this.addSql('alter table `organisation_pricing_plan_action` add constraint `organisation_pricing_plan_action_organisation_pri_a08fe_foreign` foreign key (`organisation_pricing_plan_id`) references `organisation_pricing_plan` (`id`) on update cascade;')

    this.addSql('alter table `organisation` add `pricing_plan_id` int unsigned not null;')
    this.addSql('alter table `organisation` add constraint `organisation_pricing_plan_id_foreign` foreign key (`pricing_plan_id`) references `organisation_pricing_plan` (`id`) on update cascade;')
    this.addSql('alter table `organisation` add unique `organisation_pricing_plan_id_unique`(`pricing_plan_id`);')
  }

  async down(): Promise<void> {
    this.addSql('alter table `pricing_plan_action` drop foreign key `pricing_plan_action_pricing_plan_id_foreign`;')

    this.addSql('alter table `organisation_pricing_plan` drop foreign key `organisation_pricing_plan_pricing_plan_id_foreign`;')

    this.addSql('alter table `organisation` drop foreign key `organisation_pricing_plan_id_foreign`;')

    this.addSql('alter table `organisation_pricing_plan_action` drop foreign key `organisation_pricing_plan_action_organisation_pri_a08fe_foreign`;')

    this.addSql('drop table if exists `pricing_plan`;')

    this.addSql('drop table if exists `pricing_plan_action`;')

    this.addSql('drop table if exists `organisation_pricing_plan`;')

    this.addSql('drop table if exists `organisation_pricing_plan_action`;')

    this.addSql('alter table `organisation` drop index `organisation_pricing_plan_id_unique`;')
    this.addSql('alter table `organisation` drop `pricing_plan_id`;')
  }

}
