# Talo usage report — 2026-09-07

"This month" = September 2026. Integrations with a non-null `deleted_at` are excluded — note the `integration` table currently has no soft-delete column, so no rows were filtered.

## 1. Health summary

### health_summary

| Metric             | Value   |
| ------------------ | ------- |
| Players            | 341,658 |
| Games              | 1,945   |
| Games with players | 1,122   |
| Organisations      | 1,780   |
| Users              | 1,866   |

### game_player_count_buckets

| Bucket      | Games |
| ----------- | ----- |
| 0–49        | 435   |
| 50–99       | 42    |
| 100–499     | 57    |
| 500–999     | 14    |
| 1,000–4,999 | 23    |
| 5,000–9,999 | 4     |
| 10,000+     | 6     |

## 2. Users

| Metric                                    | Value |
| ----------------------------------------- | ----- |
| New users today                           | 3     |
| New users this month                      | 16    |
| Signed up last month, not seen this month | 80    |
| Unverified email (signed up this month)   | 0     |

## 3. Players

| Metric                 | Value  |
| ---------------------- | ------ |
| New players today      | 1,815  |
| New players this month | 27,595 |

### Top 10 games by players (this month)

| Game                            | Players |
| ------------------------------- | ------- |
| Ultrapool                       | 18,371  |
| Češťyňák - TEST                 | 1,996   |
| Sudokiller                      | 1,442   |
| InfiKnight                      | 1,238   |
| Survivors Guild Demo            | 706     |
| Warren Breach: Puzzle Nightmare | 357     |
| Organized Inside                | 312     |
| Rust & Rope                     | 224     |
| Moto Trial Turbo                | 199     |
| Goblin Escape                   | 165     |

### Top 10 games by players (total)

| Game                       | Players |
| -------------------------- | ------- |
| Ultrapool                  | 91,295  |
| Organized Inside           | 24,247  |
| Survivors Guild Demo       | 14,822  |
| TopSmashdle                | 10,500  |
| KitchenTogether            | 10,500  |
| Goblin Escape              | 10,388  |
| Super Incremental          | 9,575   |
| One More Goblin Generation | 8,993   |
| Bima Blast                 | 8,544   |
| Bearly Brave               | 8,332   |

### Top 10 player alias services (this month)

| Service           | Aliases |
| ----------------- | ------- |
| anonymous         | 11,903  |
| steam_id          | 4,859   |
| google_play_games | 3,743   |
| talo              | 1,489   |
| steam             | 871     |
| username          | 642     |
| device            | 415     |
| wordpress         | 335     |
| guest             | 322     |
| editor            | 260     |

### Top 10 player alias services (total)

| Service           | Aliases |
| ----------------- | ------- |
| anonymous         | 79,181  |
| username          | 50,339  |
| steam             | 48,820  |
| google_play_games | 25,184  |
| talo              | 19,528  |
| ItchIO            | 18,568  |
| steam_id          | 16,707  |
| player_id         | 8,330   |
| guest             | 7,316   |
| device            | 7,064   |

## 4. Game configs

22 games were created this month; 1,945 in total.

| Config                              | Created this month | Total |
| ----------------------------------- | ------------------ | ----- |
| Games                               | 22                 | 1,945 |
| With live config                    | 2                  | 101   |
| Alias identifier profanity blocking | 1                  | 57    |
| Props profanity blocking            | 1                  | 67    |
| Request verification                | 2                  | 21    |
| Display name prop key set           | 1                  | 46    |
| Logo set                            | 0                  | 6     |
| Has an admin API key                | 4                  | 16    |

## 5. Game activity

| Activity type                  | This month | Total  |
| ------------------------------ | ---------- | ------ |
| Player deleted                 | 155        | 12,257 |
| Game stat created              | 131        | 4,479  |
| Feedback category created      | 65         | 333    |
| Channel deleted                | 54         | 697    |
| Leaderboard entry hidden       | 44         | 4,013  |
| Leaderboard created            | 38         | 2,828  |
| API key created                | 26         | 2,203  |
| API key updated                | 25         | 943    |
| Player dev build toggled       | 23         | 407    |
| Inactive dev players deleted   | 19         | 226    |
| Leaderboard updated            | 15         | 810    |
| Inactive live players deleted  | 15         | 80     |
| Game props updated             | 14         | 927    |
| Leaderboard entries reset      | 14         | 806    |
| Game settings updated          | 12         | 307    |
| Integration added              | 9          | 91     |
| Verification key created       | 9          | 45     |
| API key revoked                | 7          | 569    |
| Data export requested          | 7          | 427    |
| Player props updated           | 6          | 840    |
| Leaderboard entry updated      | 6          | 811    |
| Channel updated                | 5          | 104    |
| Admin API key created          | 5          | 19     |
| Player group created           | 4          | 169    |
| Verification key deleted       | 4          | 12     |
| Leaderboard entry restored     | 3          | 904    |
| Leaderboard deleted            | 3          | 437    |
| Invite created                 | 3          | 110    |
| Invite accepted                | 3          | 88     |
| Integration updated            | 3          | 80     |
| Event retention updated        | 3          | 3      |
| Player group updated           | 2          | 149    |
| Feedback archived              | 1          | 496    |
| Game stat deleted              | 1          | 285    |
| Player group deleted           | 1          | 28     |
| Game stat updated              | 0          | 638    |
| Game stat reset                | 0          | 330    |
| Game name updated              | 0          | 195    |
| Channel created                | 0          | 178    |
| Player stat updated            | 0          | 78     |
| Feedback category updated      | 0          | 60     |
| Feedback category deleted      | 0          | 33     |
| Steamworks leaderboards synced | 0          | 21     |
| Steamworks stats synced        | 0          | 20     |
| Integration deleted            | 0          | 8      |
| Feedback restored              | 0          | 5      |
| Admin API key revoked          | 0          | 4      |
| Organisation member removed    | 0          | 3      |
| Admin API key updated          | 0          | 3      |
| Feedback category reset        | 0          | 2      |

## 6. Features

| Feature                        | Created this month | Total      |
| ------------------------------ | ------------------ | ---------- |
| Events                         | 2,585,331          | 18,888,394 |
| Event funnels                  | 5                  | 5          |
| Event retention configs        | 0                  | 0          |
| Leaderboards                   | 35                 | 2,404      |
| Stats                          | 131                | 4,210      |
| Saves                          | 275                | 18,909     |
| Feedback                       | 16                 | 1,379      |
| Player groups                  | 4                  | 141        |
| Channels                       | 16                 | 2,175      |
| Player subscriptions           | 31                 | 156        |
| Steam integrations             | 1                  | 51         |
| Google Play Games integrations | 4                  | 18         |
| Apple Game Center integrations | 4                  | 14         |

## 7. Integrations

| Integration       | Events this month | Events total |
| ----------------- | ----------------- | ------------ |
| Steam             | 29,337            | 334,872      |
| Google Play Games | 64,890            | 283,713      |
| Apple Game Center | 67                | 843          |

### Top 10 games by integration events

| Game                     | Steam   | Google Play Games | Game Center | Total   |
| ------------------------ | ------- | ----------------- | ----------- | ------- |
| Ultrapool                | 34,540  | 274,732           | 0           | 309,272 |
| Organized Inside         | 261,024 | 0                 | 0           | 261,024 |
| Survivors Guild Demo     | 27,390  | 0                 | 0           | 27,390  |
| MNEMONIC: Daily Puzzle   | 0       | 7,454             | 28          | 7,482   |
| Market Fit               | 2,545   | 0                 | 0           | 2,545   |
| Eye of the Commando      | 1,957   | 0                 | 0           | 1,957   |
| King of Kingdoms         | 1,474   | 0                 | 1           | 1,475   |
| csaim                    | 1,084   | 0                 | 0           | 1,084   |
| medieval match           | 0       | 390               | 629         | 1,019   |
| King of Kingdoms Release | 917     | 0                 | 7           | 924     |
