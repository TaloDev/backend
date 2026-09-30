# Talo Usage Report — 2026-09-09

Generated from the production MySQL and ClickHouse databases. "This month" = September 2026.

## 1. Health summary

### health_summary

| Player count | Game count | Games with players | Org count | User count |
| -----------: | ---------: | -----------------: | --------: | ---------: |
|      347,578 |      1,951 |              1,127 |     1,785 |      1,871 |

### game_player_count_buckets

| Tier        | Games |
| ----------- | ----: |
| 0–49        |   436 |
| 50–99       |    44 |
| 100–499     |    57 |
| 500–999     |    14 |
| 1,000–4,999 |    23 |
| 5,000–9,999 |     4 |
| 10,000+     |     6 |

## 2. Users

| Metric                                    | Count |
| ----------------------------------------- | ----: |
| New users today                           |     1 |
| New users this month                      |    21 |
| Signed up last month, not seen this month |    78 |
| New this month without verified email     |     1 |

## 3. Players

| Metric                 |  Count |
| ---------------------- | -----: |
| New players today      |  1,896 |
| New players this month | 33,517 |

### Top 10 games by players (this month)

| Game                            | Players |
| ------------------------------- | ------: |
| Ultrapool                       |  22,118 |
| Češťyňák - TEST                 |   2,097 |
| Sudokiller                      |   1,641 |
| InfiKnight                      |   1,401 |
| Survivors Guild Demo            |     780 |
| The Last Mothership             |     560 |
| Warren Breach: Puzzle Nightmare |     481 |
| Organized Inside                |     398 |
| Rust & Rope                     |     279 |
| Moto Trial Turbo                |     246 |

### Top 10 games by players (total)

| Game                       | Players |
| -------------------------- | ------: |
| Ultrapool                  |  95,042 |
| Organized Inside           |  24,333 |
| Survivors Guild Demo       |  14,896 |
| TopSmashdle                |  10,500 |
| KitchenTogether            |  10,500 |
| Goblin Escape              |  10,427 |
| Super Incremental          |   9,575 |
| One More Goblin Generation |   9,003 |
| Bima Blast                 |   8,559 |
| Bearly Brave               |   8,338 |

### Top 10 player alias services (this month)

| Service           | Aliases |
| ----------------- | ------: |
| anonymous         |  15,054 |
| steam_id          |   5,623 |
| google_play_games |   4,446 |
| talo              |   1,716 |
| steam             |   1,021 |
| username          |     843 |
| device            |     564 |
| guest             |     407 |
| wordpress         |     375 |
| editor            |     335 |

### Top 10 player alias services (total)

| Service           | Aliases |
| ----------------- | ------: |
| anonymous         |  82,332 |
| username          |  50,540 |
| steam             |  48,970 |
| google_play_games |  25,887 |
| talo              |  19,755 |
| ItchIO            |  18,578 |
| steam_id          |  17,471 |
| player_id         |   8,336 |
| guest             |   7,401 |
| device            |   7,213 |

## 4. Game configs

28 games created this month (out of 1,951 total).

| Config                              | Created this month | Total |
| ----------------------------------- | -----------------: | ----: |
| Games with live config              |                  3 |   103 |
| Alias identifier profanity blocking |                  3 |    60 |
| Props profanity blocking            |                  2 |    68 |
| Request verification                |                  2 |    21 |
| Display name prop key set           |                  1 |    46 |
| Logo set                            |                  1 |     7 |
| Admin API key                       |                  5 |    15 |

## 5. Game activity

Sorted by created this month. Activity types with zero total occurrences are omitted.

| Type                                            | This month |  Total |
| ----------------------------------------------- | ---------: | -----: |
| PLAYER_DELETED                                  |        196 | 12,298 |
| GAME_STAT_CREATED                               |        139 |  4,487 |
| GAME_FEEDBACK_CATEGORY_CREATED                  |         65 |    333 |
| GAME_CHANNEL_DELETED                            |         55 |    698 |
| LEADERBOARD_CREATED                             |         52 |  2,842 |
| LEADERBOARD_ENTRY_HIDDEN                        |         49 |  4,018 |
| API_KEY_CREATED                                 |         33 |  2,210 |
| API_KEY_UPDATED                                 |         29 |    947 |
| PLAYER_DEV_BUILD_TOGGLED                        |         27 |    411 |
| GAME_PROPS_UPDATED                              |         20 |    933 |
| INACTIVE_DEV_PLAYERS_DELETED                    |         19 |    226 |
| LEADERBOARD_UPDATED                             |         18 |    813 |
| GAME_SETTINGS_UPDATED                           |         18 |    313 |
| LEADERBOARD_ENTRIES_RESET                       |         17 |    809 |
| INACTIVE_LIVE_PLAYERS_DELETED                   |         15 |     80 |
| PLAYER_PROPS_UPDATED                            |          9 |    843 |
| DATA_EXPORT_REQUESTED                           |          9 |    429 |
| GAME_INTEGRATION_ADDED                          |          9 |     91 |
| VERIFICATION_KEY_CREATED                        |          9 |     45 |
| API_KEY_REVOKED                                 |          8 |    570 |
| LEADERBOARD_ENTRY_UPDATED                       |          7 |    812 |
| GAME_FEEDBACK_ARCHIVED                          |          7 |    502 |
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
| GAME_CHANNEL_CREATED                            |          2 |    180 |
| GAME_STAT_DELETED                               |          1 |    285 |
| GAME_NAME_UPDATED                               |          1 |    196 |
| PLAYER_GROUP_DELETED                            |          1 |     28 |
| GAME_STAT_UPDATED                               |          0 |    638 |
| GAME_STAT_RESET                                 |          0 |    330 |
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

## 6. Features

| Feature                        | Created this month |      Total |
| ------------------------------ | -----------------: | ---------: |
| Events (ClickHouse)            |          3,467,010 | 19,770,071 |
| Event funnels                  |                  7 |          7 |
| Event retention configs        |                  0 |          0 |
| Leaderboards                   |                 49 |      2,418 |
| Stats                          |                139 |      4,218 |
| Saves                          |                375 |     19,009 |
| Feedback                       |                 20 |      1,809 |
| Player groups                  |                  5 |        142 |
| Channels                       |                 18 |      2,177 |
| Player subscriptions           |                 35 |        160 |
| Steam integrations             |                  1 |         51 |
| Google Play Games integrations |                  4 |         18 |
| Apple Game Center integrations |                  4 |         14 |

## 7. Integrations

| Integration       | Events this month | Events total |
| ----------------- | ----------------: | -----------: |
| Steam             |            35,915 |      326,144 |
| Google Play Games |            84,324 |      295,753 |
| Apple Game Center |                88 |          811 |

### Top 10 games by integration events (total)

| Game                     |   Steam | Google Play Games | Game Center |   Total |
| ------------------------ | ------: | ----------------: | ----------: | ------: |
| Ultrapool                |  32,942 |           286,754 |           0 | 319,696 |
| Organized Inside         | 253,486 |                 0 |           0 | 253,486 |
| Survivors Guild Demo     |  27,705 |                 0 |           0 |  27,705 |
| MNEMONIC: Daily Puzzle   |       0 |             7,450 |          25 |   7,475 |
| Market Fit               |   2,536 |                 0 |           0 |   2,536 |
| Eye of the Commando      |   1,999 |                 0 |           0 |   1,999 |
| King of Kingdoms         |   1,474 |                 0 |           1 |   1,475 |
| csaim                    |   1,084 |                 0 |           0 |   1,084 |
| medieval match           |       0 |               386 |         591 |     977 |
| King of Kingdoms Release |     917 |                 0 |           7 |     924 |
