import { Migration } from '@mikro-orm/migrations'

export class SetUserTwoFactorAuthEnabledDefaultFalse extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `user_two_factor_auth` modify `enabled` tinyint(1) default false;')
  }
}
