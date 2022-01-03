import { Migration } from '@mikro-orm/migrations'

export class InitialMigration extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `organisation` (`id` int unsigned not null auto_increment primary key, `email` varchar(255) not null, `name` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB')

    this.addSql('create table `user` (`id` int unsigned not null auto_increment primary key, `email` varchar(255) not null, `password` varchar(255) not null, `organisation_id` int(11) unsigned not null, `type` tinyint not null, `last_seen_at` datetime not null, `email_confirmed` tinyint(1) not null default false, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `user` add index `user_organisation_id_index`(`organisation_id`)')

    this.addSql('create table `user_access_code` (`id` int unsigned not null auto_increment primary key, `code` varchar(255) not null, `user_id` int(11) unsigned not null, `created_at` datetime not null, `valid_until` datetime null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `user_access_code` add index `user_access_code_user_id_index`(`user_id`)')

    this.addSql('create table `user_session` (`id` int unsigned not null auto_increment primary key, `token` varchar(255) not null, `user_agent` varchar(255) null, `user_id` int(11) unsigned not null, `created_at` datetime not null, `valid_until` datetime not null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `user_session` add index `user_session_user_id_index`(`user_id`)')

    this.addSql('create table `failed_job` (`id` int unsigned not null auto_increment primary key, `queue` varchar(255) not null, `payload` json null, `reason` varchar(255) not null, `failed_at` datetime not null) default character set utf8mb4 engine = InnoDB')

    this.addSql('create table `game` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `organisation_id` int(11) unsigned not null, `props` json not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `game` add index `game_organisation_id_index`(`organisation_id`)')

    this.addSql('create table `player` (`id` varchar(255) not null, `props` json not null, `game_id` int(11) unsigned not null, `last_seen_at` datetime not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `player` add primary key `player_pkey`(`id`)')
    this.addSql('alter table `player` add index `player_game_id_index`(`game_id`)')

    this.addSql('create table `player_alias` (`id` int unsigned not null auto_increment primary key, `service` varchar(255) not null, `identifier` varchar(255) not null, `player_id` varchar(255) null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `player_alias` add index `player_alias_player_id_index`(`player_id`)')

    this.addSql('create table `event` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `props` json not null, `game_id` int(11) unsigned not null, `player_alias_id` int(11) unsigned not null, `created_at` datetime not null, `updated_at` datetime not null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `event` add index `event_game_id_index`(`game_id`)')
    this.addSql('alter table `event` add index `event_player_alias_id_index`(`player_alias_id`)')

    this.addSql('create table `apikey` (`id` int unsigned not null auto_increment primary key, `scopes` text not null, `game_id` int(11) unsigned not null, `created_by_user_id` int(11) unsigned not null, `created_at` datetime not null, `revoked_at` datetime null) default character set utf8mb4 engine = InnoDB')
    this.addSql('alter table `apikey` add index `apikey_game_id_index`(`game_id`)')
    this.addSql('alter table `apikey` add index `apikey_created_by_user_id_index`(`created_by_user_id`)')

    this.addSql('alter table `user` add constraint `user_organisation_id_foreign` foreign key (`organisation_id`) references `organisation` (`id`) on update cascade')

    this.addSql('alter table `user_access_code` add constraint `user_access_code_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade')

    this.addSql('alter table `user_session` add constraint `user_session_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade')

    this.addSql('alter table `game` add constraint `game_organisation_id_foreign` foreign key (`organisation_id`) references `organisation` (`id`) on update cascade')

    this.addSql('alter table `player` add constraint `player_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade')

    this.addSql('alter table `player_alias` add constraint `player_alias_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on delete cascade')

    this.addSql('alter table `event` add constraint `event_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade')
    this.addSql('alter table `event` add constraint `event_player_alias_id_foreign` foreign key (`player_alias_id`) references `player_alias` (`id`) on update cascade')

    this.addSql('alter table `apikey` add constraint `apikey_game_id_foreign` foreign key (`game_id`) references `game` (`id`) on update cascade')
    this.addSql('alter table `apikey` add constraint `apikey_created_by_user_id_foreign` foreign key (`created_by_user_id`) references `user` (`id`) on update cascade')
  }

}
