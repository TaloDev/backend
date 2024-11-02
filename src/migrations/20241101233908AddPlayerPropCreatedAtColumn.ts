import { Migration } from '@mikro-orm/migrations'

export class AddPlayerPropCreatedAtColumn extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table `player_prop` add `created_at` datetime not null default CURRENT_TIMESTAMP;')
    this.addSql('update `player_prop` set `created_at` = (select `updated_at` from `player` where `player`.`id` = `player_prop`.`player_id`);')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `player_prop` drop column `created_at`;')

    this.addSql('alter table `apikey` modify `scopes` text not null;')
  }

}
