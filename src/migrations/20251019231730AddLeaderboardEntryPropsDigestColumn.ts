import { Migration } from '@mikro-orm/migrations'
import LeaderboardEntry from '../entities/leaderboard-entry.js'

type LeaderboardEntryBatch = { id: number; propsDigest: string }
type EntryPropRow = { entryId: number; key: string; value: string }

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

  // reads the rows directly instead of through entities: their metadata describes a
  // newer schema than the one this migration runs against
  private async loadBatch(after: number): Promise<LeaderboardEntryBatch[]> {
    const connection = this.getEntityManager().getConnection()

    const entries: { id: number }[] = await connection.execute(
      'select `id` from `leaderboard_entry` where `id` > ? order by `id` asc limit ?',
      [after, MAX_BATCH_SIZE],
    )

    if (entries.length === 0) {
      return []
    }

    const ids = entries.map((entry) => entry.id)
    const props: EntryPropRow[] = await connection.execute(
      `select \`leaderboard_entry_id\` as \`entryId\`, \`key\`, \`value\` from \`leaderboard_entry_prop\` where \`leaderboard_entry_id\` in (${ids.map(() => '?').join(',')}) order by \`id\` asc`,
      ids,
    )

    return entries.map(({ id }) => ({
      id,
      propsDigest: LeaderboardEntry.createPropsDigest(
        props.filter((prop) => prop.entryId === id).map(({ key, value }) => ({ key, value })),
      ),
    }))
  }

  override async up(): Promise<void> {
    const connection = this.getEntityManager().getConnection()
    await connection.execute('alter table `leaderboard_entry` add `props_digest` varchar(255);')

    // backfill in id order, one batch of entries at a time
    let after = 0
    while (true) {
      const batch = await this.loadBatch(after)
      if (batch.length === 0) {
        break
      }

      await this.updateBatch(batch)
      after = batch[batch.length - 1].id
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
