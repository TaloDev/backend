import archiveLeaderboardEntries from '../tasks/archiveLeaderboardEntries'
import createQueue from '../lib/queues/createQueue'

const ARCHIVE_LEADERBOARD_ENTRIES = 'archive-leaderboard-entries'

export default async function initScheduledTasks() {
  await createQueue(ARCHIVE_LEADERBOARD_ENTRIES, archiveLeaderboardEntries).upsertJobScheduler(
    `${ARCHIVE_LEADERBOARD_ENTRIES}-scheduler`,
    { pattern: '0 0 0 * * *' },
    { name: `${ARCHIVE_LEADERBOARD_ENTRIES}-job` }
  )
}
