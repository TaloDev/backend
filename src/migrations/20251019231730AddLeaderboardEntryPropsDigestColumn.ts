import { Migration } from '@mikro-orm/migrations'
import LeaderboardEntry from '../entities/leaderboard-entry'
import { streamByCursor } from '../lib/perf/streamByCursor'

export class AddLeaderboardEntryPropsDigestColumn extends Migration {

  override async up(): Promise<void> {
    const em = this.getEntityManager()
    await em.execute('alter table `leaderboard_entry` add `props_digest` varchar(255);')

    const entryStream = streamByCursor<LeaderboardEntry>(async (batchSize, after) => {
      return em.repo(LeaderboardEntry).findByCursor({}, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' }
      })
    }, 100)

    for await (const entry of entryStream) {
      const propsDigest = LeaderboardEntry.createPropsDigest(entry.props.getItems())
      await em.repo(LeaderboardEntry).nativeUpdate(entry.id, { propsDigest })
    }

    this.addSql('alter table `leaderboard_entry` modify `props_digest` varchar(255) not null;')
    this.addSql('alter table `leaderboard_entry` add index `leaderboard_entry_props_digest_index`(`props_digest`);')
  }

  override async down(): Promise<void> {
    this.addSql('alter table `leaderboard_entry` drop index `leaderboard_entry_props_digest_index`;')
    this.addSql('alter table `leaderboard_entry` drop column `props_digest`;')
  }

}
