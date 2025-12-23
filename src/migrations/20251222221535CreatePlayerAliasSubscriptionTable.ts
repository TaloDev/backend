import { Migration } from '@mikro-orm/migrations'

export class CreatePlayerAliasSubscriptionTable extends Migration {

  override async up(): Promise<void> {
    this.addSql('create table `player_alias_subscription` (`id` int unsigned not null auto_increment primary key, `subscriber_id` int unsigned not null, `subscribed_to_id` int unsigned not null, `confirmed` tinyint(1) not null default false, `relationship_type` enum(\'unidirectional\', \'bidirectional\') not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `player_alias_subscription` add index `player_alias_subscription_subscriber_id_index`(`subscriber_id`);')
    this.addSql('alter table `player_alias_subscription` add index `player_alias_subscription_subscribed_to_id_index`(`subscribed_to_id`);')
    this.addSql('alter table `player_alias_subscription` add index `player_alias_subscription_subscribed_to_id_confirmed_index`(`subscribed_to_id`, `confirmed`);')
    this.addSql('alter table `player_alias_subscription` add unique `player_alias_subscription_subscriber_id_subscribed_to_id_unique`(`subscriber_id`, `subscribed_to_id`);')

    this.addSql('alter table `player_alias_subscription` add constraint `player_alias_subscription_subscriber_id_foreign` foreign key (`subscriber_id`) references `player_alias` (`id`) on update cascade on delete cascade;')
    this.addSql('alter table `player_alias_subscription` add constraint `player_alias_subscription_subscribed_to_id_foreign` foreign key (`subscribed_to_id`) references `player_alias` (`id`) on update cascade on delete cascade;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `player_alias_subscription`;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

}
