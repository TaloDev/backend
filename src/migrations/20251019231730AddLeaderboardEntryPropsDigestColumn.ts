import { Migration } from '@mikro-orm/migrations'
import LeaderboardEntry from '../entities/leaderboard-entry'
import { streamByCursor } from '../lib/perf/streamByCursor'

type LeaderboardEntryBatch = { id: number; propsDigest: string }
const MAX_BATCH_SIZE = 100

export class AddLeaderboardEntryPropsDigestColumn extends Migration {
  private async updateBatch(batch: LeaderboardEntryBatch[]) {
    await this.getEntityManager()
      .getConnection()
      .execute(
        'UPDATE leaderboard_entry SET props_digest = CASE id ' +
          batch.map(() => 'WHEN ? THEN ?').join(' ') +
          ' END WHERE id IN (' +
          batch.map(() => '?').join(',') +
          ')',
        [...batch.flatMap((b) => [b.id, b.propsDigest]), ...batch.map((b) => b.id)],
      )
  }

  override async up(): Promise<void> {
    const em = this.getEntityManager()
    await em.execute('alter table `leaderboard_entry` add `props_digest` varchar(255);')

    const entryStream = streamByCursor<LeaderboardEntry>(async (batchSize, after) => {
      return em.repo(LeaderboardEntry).findByCursor(
        {},
        {
          first: batchSize,
          after,
          orderBy: { id: 'asc' },
        },
      )
    }, 100)

    const batch: LeaderboardEntryBatch[] = []
    for await (const entry of entryStream) {
      const propsDigest = LeaderboardEntry.createPropsDigest(entry.props.getItems())
      batch.push({ id: entry.id, propsDigest })

      if (batch.length >= MAX_BATCH_SIZE) {
        await this.updateBatch(batch)
        batch.length = 0
      }
    }

    // handle remaining items in batch
    if (batch.length > 0) {
      await this.updateBatch(batch)
    }

    this.addSql('alter table `leaderboard_entry` modify `props_digest` varchar(255) not null;')
    this.addSql(
      'alter table `leaderboard_entry` add index `leaderboard_entry_props_digest_index`(`props_digest`);',
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table `leaderboard_entry` drop index `leaderboard_entry_props_digest_index`;',
    )
    this.addSql('alter table `leaderboard_entry` drop column `props_digest`;')
  }
}
