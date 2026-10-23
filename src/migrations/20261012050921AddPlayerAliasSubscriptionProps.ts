import { Migration } from '@mikro-orm/migrations'

export class AddPlayerAliasSubscriptionProps extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table `player_alias_subscription_prop` (`id` int unsigned not null auto_increment primary key, `subscription_id` int unsigned not null, `key` varchar(128) not null, `value` varchar(512) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;',
    )

    this.addSql(
      'alter table `player_alias_subscription_prop` add index `player_alias_subscription_prop_subscription_id_index` (`subscription_id`);',
    )

    this.addSql(
      'alter table `player_alias_subscription_prop` add constraint `player_alias_subscription_prop_subscription_id_foreign` foreign key (`subscription_id`) references `player_alias_subscription` (`id`) on delete cascade;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `player_alias_subscription_prop`;')
  }
}
