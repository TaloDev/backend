import { Migration } from '@mikro-orm/migrations'

export class DropPlanActionTablesAddPlayerLimit extends Migration {
  override async up(): Promise<void> {
    this.addSql('drop table if exists `organisation_pricing_plan_action`;')

    this.addSql('drop table if exists `pricing_plan_action`;')

    this.addSql('alter table `pricing_plan` add `player_limit` int null;')
  }

  override async down(): Promise<void> {
    this.addSql(
      'create table `organisation_pricing_plan_action` (`id` int unsigned not null auto_increment primary key, `organisation_pricing_plan_id` int unsigned not null, `type` tinyint not null, `extra` json not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `organisation_pricing_plan_action` add index `organisation_pricing_plan_action_organisation_prici_03129_index`(`organisation_pricing_plan_id`);',
    )

    this.addSql(
      'create table `pricing_plan_action` (`id` int unsigned not null auto_increment primary key, `pricing_plan_id` int unsigned not null, `type` tinyint not null, `limit` int not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )
    this.addSql(
      'alter table `pricing_plan_action` add index `pricing_plan_action_pricing_plan_id_index`(`pricing_plan_id`);',
    )

    this.addSql(
      'alter table `organisation_pricing_plan_action` add constraint `organisation_pricing_plan_action_organisation_pri_a08fe_foreign` foreign key (`organisation_pricing_plan_id`) references `organisation_pricing_plan` (`id`) on update cascade;',
    )

    this.addSql(
      'alter table `pricing_plan_action` add constraint `pricing_plan_action_pricing_plan_id_foreign` foreign key (`pricing_plan_id`) references `pricing_plan` (`id`) on update cascade;',
    )

    this.addSql('alter table `pricing_plan` drop column `player_limit`;')
  }
}
