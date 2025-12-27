import { Migration } from '@mikro-orm/migrations'

export class AddUsernameColumn extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` add `username` varchar(255) not null;')

    this.addSql('alter table `data_export` modify `entities` text not null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `user` drop `username`;')

    this.addSql('alter table `data_export` modify `entities` text not null;')
  }

}
