import { Migration } from '@mikro-orm/migrations'

export class CreatePlayerPropsTable extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `player_prop` (`id` int unsigned not null auto_increment primary key, `player_id` varchar(255) not null, `key` varchar(255) not null, `value` varchar(255) not null) default character set utf8mb4 engine = InnoDB;')
    this.addSql('alter table `player_prop` add index `player_prop_player_id_index`(`player_id`);')

    this.addSql('alter table `player_prop` add constraint `player_prop_player_id_foreign` foreign key (`player_id`) references `player` (`id`) on update cascade;')

    this.addSql('insert into `player_prop` (`player_id`, `key`, `value`) select `p`.`id`, `r`.* from `player` as `p`, json_table(`p`.`props`, \'$[*]\' columns (`key` varchar(255) path \'$.key\', `value` varchar(255) path \'$.value\')) as `r`')

    this.addSql('alter table `player` drop `props`;')
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists `player_prop`;')

    this.addSql('alter table `player` add `props` json not null;')
  }

}
