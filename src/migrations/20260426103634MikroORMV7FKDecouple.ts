import { Migration } from '@mikro-orm/migrations'

export class MikroORMV7FKDecouple extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`organisation_pricing_plan\` drop foreign key \`organisation_pricing_plan_pricing_plan_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`organisation\` drop foreign key \`organisation_pricing_plan_id_foreign\`;`,
    )

    this.addSql(`alter table \`game\` drop foreign key \`game_organisation_id_foreign\`;`)
    this.addSql(`alter table \`game\` drop foreign key \`game_api_secret_id_foreign\`;`)

    this.addSql(`alter table \`player_group\` drop foreign key \`player_group_game_id_foreign\`;`)

    this.addSql(`alter table \`player\` drop foreign key \`player_game_id_foreign\`;`)
    this.addSql(`alter table \`player\` drop foreign key \`player_auth_id_foreign\`;`)
    this.addSql(`alter table \`player\` drop foreign key \`player_presence_id_foreign\`;`)

    this.addSql(
      `alter table \`players_to_delete\` drop foreign key \`players_to_delete_player_id_foreign\`;`,
    )

    this.addSql(`alter table \`player_prop\` drop foreign key \`player_prop_player_id_foreign\`;`)

    this.addSql(
      `alter table \`player_auth_activity\` drop foreign key \`player_auth_activity_player_id_foreign\`;`,
    )

    this.addSql(`alter table \`player_alias\` drop foreign key \`player_alias_player_id_foreign\`;`)

    this.addSql(
      `alter table \`player_presence\` drop foreign key \`player_presence_player_alias_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`player_alias_subscription\` drop foreign key \`player_alias_subscription_subscriber_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`player_alias_subscription\` drop foreign key \`player_alias_subscription_subscribed_to_id_foreign\`;`,
    )

    this.addSql(`alter table \`game_save\` drop foreign key \`game_save_player_id_foreign\`;`)

    this.addSql(`alter table \`leaderboard\` drop foreign key \`leaderboard_game_id_foreign\`;`)

    this.addSql(
      `alter table \`leaderboard_entry\` drop foreign key \`leaderboard_entry_leaderboard_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` drop foreign key \`leaderboard_entry_player_alias_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`leaderboard_entry_prop\` drop foreign key \`leaderboard_entry_prop_leaderboard_entry_id_foreign\`;`,
    )

    this.addSql(`alter table \`integration\` drop foreign key \`integration_game_id_foreign\`;`)

    this.addSql(
      `alter table \`google_play_games_integration_event\` drop foreign key \`google_play_games_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(`alter table \`game_stat\` drop foreign key \`game_stat_game_id_foreign\`;`)

    this.addSql(
      `alter table \`player_game_stat\` drop foreign key \`player_game_stat_player_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`player_game_stat\` drop foreign key \`player_game_stat_stat_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_feedback_category\` drop foreign key \`game_feedback_category_game_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_feedback\` drop foreign key \`game_feedback_category_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`game_feedback\` drop foreign key \`game_feedback_player_alias_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_feedback_prop\` drop foreign key \`game_feedback_prop_game_feedback_id_foreign\`;`,
    )

    this.addSql(`alter table \`game_channel\` drop foreign key \`game_channel_owner_id_foreign\`;`)
    this.addSql(`alter table \`game_channel\` drop foreign key \`game_channel_game_id_foreign\`;`)

    this.addSql(
      `alter table \`game_channel_storage_prop\` drop foreign key \`game_channel_storage_prop_game_channel_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` drop foreign key \`game_channel_storage_prop_created_by_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` drop foreign key \`game_channel_storage_prop_last_updated_by_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_channel_prop\` drop foreign key \`game_channel_prop_game_channel_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` drop foreign key \`steamworks_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` drop foreign key \`steamworks_leaderboard_mapping_leaderboard_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop foreign key \`steamworks_leaderboard_entry_steamworks_leaderboa_6dc1e_foreign\`;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop foreign key \`steamworks_leaderboard_entry_leaderboard_entry_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` drop foreign key \`steamworks_player_stat_stat_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` drop foreign key \`steamworks_player_stat_player_stat_id_foreign\`;`,
    )

    this.addSql(`alter table \`user\` drop foreign key \`user_organisation_id_foreign\`;`)
    this.addSql(`alter table \`user\` drop foreign key \`user_two_factor_auth_id_foreign\`;`)

    this.addSql(`alter table \`user_session\` drop foreign key \`user_session_user_id_foreign\`;`)

    this.addSql(
      `alter table \`user_recovery_code\` drop foreign key \`user_recovery_code_user_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`user_pinned_group\` drop foreign key \`user_pinned_group_user_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`user_pinned_group\` drop foreign key \`user_pinned_group_group_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`user_access_code\` drop foreign key \`user_access_code_user_id_foreign\`;`,
    )

    this.addSql(`alter table \`invite\` drop foreign key \`invite_organisation_id_foreign\`;`)
    this.addSql(`alter table \`invite\` drop foreign key \`invite_invited_by_user_id_foreign\`;`)

    this.addSql(`alter table \`game_activity\` drop foreign key \`game_activity_game_id_foreign\`;`)
    this.addSql(`alter table \`game_activity\` drop foreign key \`game_activity_user_id_foreign\`;`)

    this.addSql(
      `alter table \`data_export\` drop foreign key \`data_export_created_by_user_id_foreign\`;`,
    )
    this.addSql(`alter table \`data_export\` drop foreign key \`data_export_game_id_foreign\`;`)

    this.addSql(`alter table \`apikey\` drop foreign key \`apikey_game_id_foreign\`;`)
    this.addSql(`alter table \`apikey\` drop foreign key \`apikey_created_by_user_id_foreign\`;`)

    this.addSql(
      `alter table \`organisation_pricing_plan\` add constraint \`organisation_pricing_plan_pricing_plan_id_foreign\` foreign key (\`pricing_plan_id\`) references \`pricing_plan\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`organisation\` add constraint \`organisation_pricing_plan_id_foreign\` foreign key (\`pricing_plan_id\`) references \`organisation_pricing_plan\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`game\` add constraint \`game_organisation_id_foreign\` foreign key (\`organisation_id\`) references \`organisation\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`game\` add constraint \`game_api_secret_id_foreign\` foreign key (\`api_secret_id\`) references \`game_secret\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`player_group\` add constraint \`player_group_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`player\` add constraint \`player_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`player\` add constraint \`player_auth_id_foreign\` foreign key (\`auth_id\`) references \`player_auth\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`player\` add constraint \`player_presence_id_foreign\` foreign key (\`presence_id\`) references \`player_presence\` (\`id\`) on delete set null;`,
    )

    this.addSql(
      `alter table \`players_to_delete\` add constraint \`players_to_delete_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_prop\` add constraint \`player_prop_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_auth_activity\` add constraint \`player_auth_activity_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_alias\` add constraint \`player_alias_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_presence\` add constraint \`player_presence_player_alias_id_foreign\` foreign key (\`player_alias_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_alias_subscription\` add constraint \`player_alias_subscription_subscriber_id_foreign\` foreign key (\`subscriber_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`player_alias_subscription\` add constraint \`player_alias_subscription_subscribed_to_id_foreign\` foreign key (\`subscribed_to_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_save\` add constraint \`game_save_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`leaderboard\` add constraint \`leaderboard_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`leaderboard_entry\` add constraint \`leaderboard_entry_leaderboard_id_foreign\` foreign key (\`leaderboard_id\`) references \`leaderboard\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` add constraint \`leaderboard_entry_player_alias_id_foreign\` foreign key (\`player_alias_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`leaderboard_entry_prop\` add constraint \`leaderboard_entry_prop_leaderboard_entry_id_foreign\` foreign key (\`leaderboard_entry_id\`) references \`leaderboard_entry\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`integration\` add constraint \`integration_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`google_play_games_integration_event\` add constraint \`google_play_games_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`game_stat\` add constraint \`game_stat_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`player_game_stat\` add constraint \`player_game_stat_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`player_game_stat\` add constraint \`player_game_stat_stat_id_foreign\` foreign key (\`stat_id\`) references \`game_stat\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_feedback_category\` add constraint \`game_feedback_category_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`game_feedback\` add constraint \`game_feedback_category_id_foreign\` foreign key (\`category_id\`) references \`game_feedback_category\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`game_feedback\` add constraint \`game_feedback_player_alias_id_foreign\` foreign key (\`player_alias_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_feedback_prop\` add constraint \`game_feedback_prop_game_feedback_id_foreign\` foreign key (\`game_feedback_id\`) references \`game_feedback\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_channel\` add constraint \`game_channel_owner_id_foreign\` foreign key (\`owner_id\`) references \`player_alias\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`game_channel\` add constraint \`game_channel_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`game_channel_storage_prop\` add constraint \`game_channel_storage_prop_game_channel_id_foreign\` foreign key (\`game_channel_id\`) references \`game_channel\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` add constraint \`game_channel_storage_prop_created_by_id_foreign\` foreign key (\`created_by_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` add constraint \`game_channel_storage_prop_last_updated_by_id_foreign\` foreign key (\`last_updated_by_id\`) references \`player_alias\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_channel_prop\` add constraint \`game_channel_prop_game_channel_id_foreign\` foreign key (\`game_channel_id\`) references \`game_channel\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` add constraint \`steamworks_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add constraint \`steamworks_leaderboard_mapping_leaderboard_id_foreign\` foreign key (\`leaderboard_id\`) references \`leaderboard\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add constraint \`steamworks_leaderboard_entry_steamworks_leaderboa_15279_foreign\` foreign key (\`steamworks_leaderboard_id\`, \`leaderboard_id\`) references \`steamworks_leaderboard_mapping\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add constraint \`steamworks_leaderboard_entry_leaderboard_entry_id_foreign\` foreign key (\`leaderboard_entry_id\`) references \`leaderboard_entry\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` rename index \`steamworks_leaderboard_entry_steamworks_leaderboard_aa6b4_index\` to \`steamworks_leaderboard_entry_steamworks_leaderboard_47d69_index\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` add constraint \`steamworks_player_stat_stat_id_foreign\` foreign key (\`stat_id\`) references \`game_stat\` (\`id\`) on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` add constraint \`steamworks_player_stat_player_stat_id_foreign\` foreign key (\`player_stat_id\`) references \`player_game_stat\` (\`id\`) on delete set null;`,
    )

    this.addSql(
      `alter table \`user\` add constraint \`user_organisation_id_foreign\` foreign key (\`organisation_id\`) references \`organisation\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`user\` add constraint \`user_two_factor_auth_id_foreign\` foreign key (\`two_factor_auth_id\`) references \`user_two_factor_auth\` (\`id\`) on delete set null;`,
    )

    this.addSql(
      `alter table \`user_session\` add constraint \`user_session_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`user_recovery_code\` add constraint \`user_recovery_code_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on delete cascade;`,
    )

    this.addSql(
      `alter table \`user_pinned_group\` add constraint \`user_pinned_group_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`user_pinned_group\` add constraint \`user_pinned_group_group_id_foreign\` foreign key (\`group_id\`) references \`player_group\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`user_access_code\` add constraint \`user_access_code_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`invite\` add constraint \`invite_organisation_id_foreign\` foreign key (\`organisation_id\`) references \`organisation\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`invite\` add constraint \`invite_invited_by_user_id_foreign\` foreign key (\`invited_by_user_id\`) references \`user\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on delete set null;`,
    )
    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`data_export\` add constraint \`data_export_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`data_export\` add constraint \`data_export_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )

    this.addSql(
      `alter table \`apikey\` add constraint \`apikey_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`);`,
    )
    this.addSql(
      `alter table \`apikey\` add constraint \`apikey_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`organisation_pricing_plan\` drop foreign key \`organisation_pricing_plan_pricing_plan_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`organisation\` drop foreign key \`organisation_pricing_plan_id_foreign\`;`,
    )

    this.addSql(`alter table \`game\` drop foreign key \`game_organisation_id_foreign\`;`)
    this.addSql(`alter table \`game\` drop foreign key \`game_api_secret_id_foreign\`;`)

    this.addSql(`alter table \`player_group\` drop foreign key \`player_group_game_id_foreign\`;`)

    this.addSql(`alter table \`player\` drop foreign key \`player_game_id_foreign\`;`)
    this.addSql(`alter table \`player\` drop foreign key \`player_auth_id_foreign\`;`)
    this.addSql(`alter table \`player\` drop foreign key \`player_presence_id_foreign\`;`)

    this.addSql(
      `alter table \`players_to_delete\` drop foreign key \`players_to_delete_player_id_foreign\`;`,
    )

    this.addSql(`alter table \`player_prop\` drop foreign key \`player_prop_player_id_foreign\`;`)

    this.addSql(
      `alter table \`player_auth_activity\` drop foreign key \`player_auth_activity_player_id_foreign\`;`,
    )

    this.addSql(`alter table \`player_alias\` drop foreign key \`player_alias_player_id_foreign\`;`)

    this.addSql(
      `alter table \`player_presence\` drop foreign key \`player_presence_player_alias_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`player_alias_subscription\` drop foreign key \`player_alias_subscription_subscriber_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`player_alias_subscription\` drop foreign key \`player_alias_subscription_subscribed_to_id_foreign\`;`,
    )

    this.addSql(`alter table \`game_save\` drop foreign key \`game_save_player_id_foreign\`;`)

    this.addSql(`alter table \`leaderboard\` drop foreign key \`leaderboard_game_id_foreign\`;`)

    this.addSql(
      `alter table \`leaderboard_entry\` drop foreign key \`leaderboard_entry_leaderboard_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` drop foreign key \`leaderboard_entry_player_alias_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`leaderboard_entry_prop\` drop foreign key \`leaderboard_entry_prop_leaderboard_entry_id_foreign\`;`,
    )

    this.addSql(`alter table \`integration\` drop foreign key \`integration_game_id_foreign\`;`)

    this.addSql(
      `alter table \`google_play_games_integration_event\` drop foreign key \`google_play_games_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(`alter table \`game_stat\` drop foreign key \`game_stat_game_id_foreign\`;`)

    this.addSql(
      `alter table \`player_game_stat\` drop foreign key \`player_game_stat_player_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`player_game_stat\` drop foreign key \`player_game_stat_stat_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_feedback_category\` drop foreign key \`game_feedback_category_game_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_feedback\` drop foreign key \`game_feedback_category_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`game_feedback\` drop foreign key \`game_feedback_player_alias_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_feedback_prop\` drop foreign key \`game_feedback_prop_game_feedback_id_foreign\`;`,
    )

    this.addSql(`alter table \`game_channel\` drop foreign key \`game_channel_owner_id_foreign\`;`)
    this.addSql(`alter table \`game_channel\` drop foreign key \`game_channel_game_id_foreign\`;`)

    this.addSql(
      `alter table \`game_channel_storage_prop\` drop foreign key \`game_channel_storage_prop_game_channel_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` drop foreign key \`game_channel_storage_prop_created_by_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` drop foreign key \`game_channel_storage_prop_last_updated_by_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`game_channel_prop\` drop foreign key \`game_channel_prop_game_channel_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` drop foreign key \`steamworks_integration_event_integration_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` drop foreign key \`steamworks_leaderboard_mapping_leaderboard_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop foreign key \`steamworks_leaderboard_entry_steamworks_leaderboa_15279_foreign\`;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` drop foreign key \`steamworks_leaderboard_entry_leaderboard_entry_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` drop foreign key \`steamworks_player_stat_stat_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` drop foreign key \`steamworks_player_stat_player_stat_id_foreign\`;`,
    )

    this.addSql(`alter table \`user\` drop foreign key \`user_organisation_id_foreign\`;`)
    this.addSql(`alter table \`user\` drop foreign key \`user_two_factor_auth_id_foreign\`;`)

    this.addSql(`alter table \`user_session\` drop foreign key \`user_session_user_id_foreign\`;`)

    this.addSql(
      `alter table \`user_recovery_code\` drop foreign key \`user_recovery_code_user_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`user_pinned_group\` drop foreign key \`user_pinned_group_user_id_foreign\`;`,
    )
    this.addSql(
      `alter table \`user_pinned_group\` drop foreign key \`user_pinned_group_group_id_foreign\`;`,
    )

    this.addSql(
      `alter table \`user_access_code\` drop foreign key \`user_access_code_user_id_foreign\`;`,
    )

    this.addSql(`alter table \`invite\` drop foreign key \`invite_organisation_id_foreign\`;`)
    this.addSql(`alter table \`invite\` drop foreign key \`invite_invited_by_user_id_foreign\`;`)

    this.addSql(`alter table \`game_activity\` drop foreign key \`game_activity_game_id_foreign\`;`)
    this.addSql(`alter table \`game_activity\` drop foreign key \`game_activity_user_id_foreign\`;`)

    this.addSql(
      `alter table \`data_export\` drop foreign key \`data_export_created_by_user_id_foreign\`;`,
    )
    this.addSql(`alter table \`data_export\` drop foreign key \`data_export_game_id_foreign\`;`)

    this.addSql(`alter table \`apikey\` drop foreign key \`apikey_game_id_foreign\`;`)
    this.addSql(`alter table \`apikey\` drop foreign key \`apikey_created_by_user_id_foreign\`;`)

    this.addSql(
      `alter table \`organisation_pricing_plan\` add constraint \`organisation_pricing_plan_pricing_plan_id_foreign\` foreign key (\`pricing_plan_id\`) references \`pricing_plan\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`organisation\` add constraint \`organisation_pricing_plan_id_foreign\` foreign key (\`pricing_plan_id\`) references \`organisation_pricing_plan\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`game\` add constraint \`game_organisation_id_foreign\` foreign key (\`organisation_id\`) references \`organisation\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`game\` add constraint \`game_api_secret_id_foreign\` foreign key (\`api_secret_id\`) references \`game_secret\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`player_group\` add constraint \`player_group_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`player\` add constraint \`player_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`player\` add constraint \`player_auth_id_foreign\` foreign key (\`auth_id\`) references \`player_auth\` (\`id\`) on update cascade on delete set null;`,
    )
    this.addSql(
      `alter table \`player\` add constraint \`player_presence_id_foreign\` foreign key (\`presence_id\`) references \`player_presence\` (\`id\`) on update cascade on delete set null;`,
    )

    this.addSql(
      `alter table \`players_to_delete\` add constraint \`players_to_delete_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_prop\` add constraint \`player_prop_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_auth_activity\` add constraint \`player_auth_activity_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_alias\` add constraint \`player_alias_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_presence\` add constraint \`player_presence_player_alias_id_foreign\` foreign key (\`player_alias_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`player_alias_subscription\` add constraint \`player_alias_subscription_subscriber_id_foreign\` foreign key (\`subscriber_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`player_alias_subscription\` add constraint \`player_alias_subscription_subscribed_to_id_foreign\` foreign key (\`subscribed_to_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_save\` add constraint \`game_save_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`leaderboard\` add constraint \`leaderboard_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`leaderboard_entry\` add constraint \`leaderboard_entry_leaderboard_id_foreign\` foreign key (\`leaderboard_id\`) references \`leaderboard\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`leaderboard_entry\` add constraint \`leaderboard_entry_player_alias_id_foreign\` foreign key (\`player_alias_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`leaderboard_entry_prop\` add constraint \`leaderboard_entry_prop_leaderboard_entry_id_foreign\` foreign key (\`leaderboard_entry_id\`) references \`leaderboard_entry\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`integration\` add constraint \`integration_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`google_play_games_integration_event\` add constraint \`google_play_games_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`game_stat\` add constraint \`game_stat_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`player_game_stat\` add constraint \`player_game_stat_player_id_foreign\` foreign key (\`player_id\`) references \`player\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`player_game_stat\` add constraint \`player_game_stat_stat_id_foreign\` foreign key (\`stat_id\`) references \`game_stat\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_feedback_category\` add constraint \`game_feedback_category_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`game_feedback\` add constraint \`game_feedback_category_id_foreign\` foreign key (\`category_id\`) references \`game_feedback_category\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`game_feedback\` add constraint \`game_feedback_player_alias_id_foreign\` foreign key (\`player_alias_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_feedback_prop\` add constraint \`game_feedback_prop_game_feedback_id_foreign\` foreign key (\`game_feedback_id\`) references \`game_feedback\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_channel\` add constraint \`game_channel_owner_id_foreign\` foreign key (\`owner_id\`) references \`player_alias\` (\`id\`) on update cascade on delete set null;`,
    )
    this.addSql(
      `alter table \`game_channel\` add constraint \`game_channel_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`game_channel_storage_prop\` add constraint \`game_channel_storage_prop_game_channel_id_foreign\` foreign key (\`game_channel_id\`) references \`game_channel\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` add constraint \`game_channel_storage_prop_created_by_id_foreign\` foreign key (\`created_by_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`game_channel_storage_prop\` add constraint \`game_channel_storage_prop_last_updated_by_id_foreign\` foreign key (\`last_updated_by_id\`) references \`player_alias\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`game_channel_prop\` add constraint \`game_channel_prop_game_channel_id_foreign\` foreign key (\`game_channel_id\`) references \`game_channel\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`steamworks_integration_event\` add constraint \`steamworks_integration_event_integration_id_foreign\` foreign key (\`integration_id\`) references \`integration\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_mapping\` add constraint \`steamworks_leaderboard_mapping_leaderboard_id_foreign\` foreign key (\`leaderboard_id\`) references \`leaderboard\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add constraint \`steamworks_leaderboard_entry_steamworks_leaderboa_6dc1e_foreign\` foreign key (\`steamworks_leaderboard_id\`, \`leaderboard_id\`) references \`steamworks_leaderboard_mapping\` (\`steamworks_leaderboard_id\`, \`leaderboard_id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` add constraint \`steamworks_leaderboard_entry_leaderboard_entry_id_foreign\` foreign key (\`leaderboard_entry_id\`) references \`leaderboard_entry\` (\`id\`) on update cascade on delete set null;`,
    )
    this.addSql(
      `alter table \`steamworks_leaderboard_entry\` rename index \`steamworks_leaderboard_entry_steamworks_leaderboard_47d69_index\` to \`steamworks_leaderboard_entry_steamworks_leaderboard_aa6b4_index\`;`,
    )

    this.addSql(
      `alter table \`steamworks_player_stat\` add constraint \`steamworks_player_stat_stat_id_foreign\` foreign key (\`stat_id\`) references \`game_stat\` (\`id\`) on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table \`steamworks_player_stat\` add constraint \`steamworks_player_stat_player_stat_id_foreign\` foreign key (\`player_stat_id\`) references \`player_game_stat\` (\`id\`) on update cascade on delete set null;`,
    )

    this.addSql(
      `alter table \`user\` add constraint \`user_organisation_id_foreign\` foreign key (\`organisation_id\`) references \`organisation\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`user\` add constraint \`user_two_factor_auth_id_foreign\` foreign key (\`two_factor_auth_id\`) references \`user_two_factor_auth\` (\`id\`) on update cascade on delete set null;`,
    )

    this.addSql(
      `alter table \`user_session\` add constraint \`user_session_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`user_recovery_code\` add constraint \`user_recovery_code_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table \`user_pinned_group\` add constraint \`user_pinned_group_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`user_pinned_group\` add constraint \`user_pinned_group_group_id_foreign\` foreign key (\`group_id\`) references \`player_group\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`user_access_code\` add constraint \`user_access_code_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`invite\` add constraint \`invite_organisation_id_foreign\` foreign key (\`organisation_id\`) references \`organisation\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`invite\` add constraint \`invite_invited_by_user_id_foreign\` foreign key (\`invited_by_user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade on delete set null;`,
    )
    this.addSql(
      `alter table \`game_activity\` add constraint \`game_activity_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`data_export\` add constraint \`data_export_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`data_export\` add constraint \`data_export_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )

    this.addSql(
      `alter table \`apikey\` add constraint \`apikey_game_id_foreign\` foreign key (\`game_id\`) references \`game\` (\`id\`) on update cascade;`,
    )
    this.addSql(
      `alter table \`apikey\` add constraint \`apikey_created_by_user_id_foreign\` foreign key (\`created_by_user_id\`) references \`user\` (\`id\`) on update cascade;`,
    )
  }
}
