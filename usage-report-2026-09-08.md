# Talo Usage Report — 2026-09-08

Month refers to September 2026 (1 Sep – today). "Last month" refers to August 2026.
Soft-deleted feedback (non-null `deleted_at`) is excluded; `integration` has no soft deletes in the DB. "Admin API key" counts games with at least one non-revoked admin API key.

## Section 1: Health summary

### health_summary

| player_count | game_count | games_with_players | org_count | user_count |
| -----------: | ---------: | -----------------: | --------: | ---------: |
|      344,672 |      1,950 |              1,125 |     1,784 |      1,870 |

### game_player_count_buckets

| Tier        | Games |
| ----------- | ----: |
| 0–49        |   438 |
| 50–99       |    42 |
| 100–499     |    57 |
| 500–999     |    14 |
| 1,000–4,999 |    23 |
| 5,000–9,999 |     4 |
| 10,000+     |     6 |

## Section 2: Users

| Metric                                    | Count |
| ----------------------------------------- | ----: |
| New users today                           |     2 |
| New users this month                      |    20 |
| Signed up last month, not seen this month |    78 |
| New this month with unverified email      |     1 |

## Section 3: Players

| Metric                 |  Count |
| ---------------------- | -----: |
| New players today      |  1,919 |
| New players this month | 30,611 |

### Top 10 games by players (this month)

| Game                            | Players |
| ------------------------------- | ------: |
| Ultrapool                       |  20,323 |
| Češťyňák - TEST                 |   2,067 |
| Sudokiller                      |   1,563 |
| InfiKnight                      |   1,310 |
| Survivors Guild Demo            |     754 |
| Warren Breach: Puzzle Nightmare |     390 |
| Organized Inside                |     352 |
| The Last Mothership             |     333 |
| Rust & Rope                     |     236 |
| Moto Trial Turbo                |     226 |

### Top 10 games by players (total)

| Game                       | Players |
| -------------------------- | ------: |
| Ultrapool                  |  93,247 |
| Organized Inside           |  24,287 |
| Survivors Guild Demo       |  14,870 |
| TopSmashdle                |  10,500 |
| KitchenTogether            |  10,500 |
| Goblin Escape              |  10,411 |
| Super Incremental          |   9,575 |
| One More Goblin Generation |   8,997 |
| Bima Blast                 |   8,548 |
| Bearly Brave               |   8,336 |

### Top 10 player alias services (this month)

| Service           | Aliases |
| ----------------- | ------: |
| anonymous         |  13,481 |
| steam_id          |   5,298 |
| google_play_games |   4,111 |
| talo              |   1,590 |
| steam             |     958 |
| username          |     741 |
| device            |     460 |
| wordpress         |     367 |
| guest             |     357 |
| editor            |     294 |

### Top 10 player alias services (total)

| Service           | Aliases |
| ----------------- | ------: |
| anonymous         |  80,760 |
| username          |  50,438 |
| steam             |  48,907 |
| google_play_games |  25,552 |
| talo              |  19,629 |
| ItchIO            |  18,572 |
| steam_id          |  17,146 |
| player_id         |   8,334 |
| guest             |   7,351 |
| device            |   7,109 |

## Section 4: Game configs

Games created this month: **27**

| Feature                             | Created this month | Total |
| ----------------------------------- | -----------------: | ----: |
| Live config (props)                 |                  3 |   102 |
| Alias identifier profanity blocking |                  2 |    59 |
| Props profanity blocking            |                  1 |    68 |
| Request verification                |                  2 |    21 |
| Display name prop key set           |                  1 |    46 |
| Logo set                            |                  0 |     6 |
| Admin API key                       |                  5 |    15 |

## Section 5: Game activity

Sorted by activity created this month. Types with no records are omitted.

| Type                                            | This month |  Total |
| ----------------------------------------------- | ---------: | -----: |
| PLAYER_DELETED                                  |        192 | 12,294 |
| GAME_STAT_CREATED                               |        139 |  4,487 |
| GAME_FEEDBACK_CATEGORY_CREATED                  |         65 |    333 |
| GAME_CHANNEL_DELETED                            |         54 |    697 |
| LEADERBOARD_ENTRY_HIDDEN                        |         47 |  4,016 |
| LEADERBOARD_CREATED                             |         45 |  2,835 |
| API_KEY_CREATED                                 |         31 |  2,208 |
| API_KEY_UPDATED                                 |         27 |    945 |
| PLAYER_DEV_BUILD_TOGGLED                        |         25 |    409 |
| INACTIVE_DEV_PLAYERS_DELETED                    |         19 |    226 |
| GAME_PROPS_UPDATED                              |         17 |    930 |
| LEADERBOARD_ENTRIES_RESET                       |         17 |    809 |
| LEADERBOARD_UPDATED                             |         16 |    811 |
| GAME_SETTINGS_UPDATED                           |         15 |    310 |
| INACTIVE_LIVE_PLAYERS_DELETED                   |         15 |     80 |
| GAME_INTEGRATION_ADDED                          |          9 |     91 |
| VERIFICATION_KEY_CREATED                        |          9 |     45 |
| PLAYER_PROPS_UPDATED                            |          8 |    842 |
| API_KEY_REVOKED                                 |          8 |    570 |
| DATA_EXPORT_REQUESTED                           |          8 |    428 |
| GAME_FEEDBACK_ARCHIVED                          |          7 |    502 |
| LEADERBOARD_ENTRY_UPDATED                       |          6 |    811 |
| PLAYER_GROUP_CREATED                            |          5 |    170 |
| GAME_CHANNEL_UPDATED                            |          5 |    104 |
| ADMIN_API_KEY_CREATED                           |          5 |     19 |
| VERIFICATION_KEY_DELETED                        |          4 |     12 |
| LEADERBOARD_ENTRY_RESTORED                      |          3 |    904 |
| LEADERBOARD_DELETED                             |          3 |    437 |
| PLAYER_GROUP_UPDATED                            |          3 |    150 |
| INVITE_CREATED                                  |          3 |    110 |
| INVITE_ACCEPTED                                 |          3 |     88 |
| GAME_INTEGRATION_UPDATED                        |          3 |     80 |
| EVENT_RETENTION_UPDATED                         |          3 |      3 |
| GAME_STAT_DELETED                               |          1 |    285 |
| PLAYER_GROUP_DELETED                            |          1 |     28 |
| GAME_STAT_UPDATED                               |          0 |    638 |
| GAME_STAT_RESET                                 |          0 |    330 |
| GAME_NAME_UPDATED                               |          0 |    195 |
| GAME_CHANNEL_CREATED                            |          0 |    178 |
| PLAYER_STAT_UPDATED                             |          0 |     78 |
| GAME_FEEDBACK_CATEGORY_UPDATED                  |          0 |     60 |
| GAME_FEEDBACK_CATEGORY_DELETED                  |          0 |     33 |
| GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED |          0 |     21 |
| GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED        |          0 |     20 |
| GAME_INTEGRATION_DELETED                        |          0 |      8 |
| GAME_FEEDBACK_RESTORED                          |          0 |      5 |
| ADMIN_API_KEY_REVOKED                           |          0 |      4 |
| ORGANISATION_MEMBER_REMOVED                     |          0 |      3 |
| ADMIN_API_KEY_UPDATED                           |          0 |      3 |
| GAME_FEEDBACK_CATEGORY_RESET                    |          0 |      2 |

## Section 6: Features

| Feature                        | Created this month |      Total |
| ------------------------------ | -----------------: | ---------: |
| Events (ClickHouse)            |          3,040,511 | 19,343,559 |
| Event funnels                  |                  6 |          6 |
| Event retention configs        |                  0 |          0 |
| Leaderboards                   |                 42 |      2,411 |
| Stats                          |                139 |      4,218 |
| Saves                          |                320 |     18,954 |
| Feedback                       |                 15 |      1,377 |
| Player groups                  |                  5 |        142 |
| Channels                       |                 17 |      2,176 |
| Player subscriptions           |                 30 |        155 |
| Steam integrations             |                  1 |         51 |
| Google Play Games integrations |                  4 |         18 |
| Apple Game Center integrations |                  4 |         14 |

## Section 7: Integrations

| Integration       | Events this month | Events total |
| ----------------- | ----------------: | -----------: |
| Steam             |            32,805 |      330,202 |
| Google Play Games |            74,770 |      290,034 |
| Apple Game Center |                75 |          832 |

### Top 10 games by integration events (total)

| Game                     |   Steam | Google Play Games | Apple Game Center |   Total |
| ------------------------ | ------: | ----------------: | ----------------: | ------: |
| Ultrapool                |  33,644 |           281,041 |                 0 | 314,685 |
| Organized Inside         | 257,025 |                 0 |                 0 | 257,025 |
| Survivors Guild Demo     |  27,627 |                 0 |                 0 |  27,627 |
| Market Fit               |   2,542 |                 0 |                 0 |   2,542 |
| Eye of the Commando      |   1,969 |                 0 |                 0 |   1,969 |
| King of Kingdoms         |   1,474 |                 0 |                 1 |   1,475 |
| csaim                    |   1,084 |                 0 |                 0 |   1,084 |
| King of Kingdoms Release |     917 |                 0 |                 7 |     924 |
| Flying Wizards           |     876 |                 0 |                 0 |     876 |
| Trash Cash               |     609 |                 0 |                 0 |     609 |
