import { Migration } from '@mikro-orm/migrations'

export class ModifyPlayerPropLengths extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_prop` modify `key` varchar(128) not null, modify `value` varchar(512) not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_prop` modify `key` varchar(255) not null, modify `value` varchar(255) not null;')
  }

}
