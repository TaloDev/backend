import archiveLeaderboardEntries from '../tasks/archiveLeaderboardEntries'
import createQueue from '../lib/queues/createQueue'
import deleteInactivePlayers from '../tasks/deleteInactivePlayers'

const ARCHIVE_LEADERBOARD_ENTRIES = 'archive-leaderboard-entries'
const DELETE_INACTIVE_PLAYERS = 'delete-inactive-players'

export default async function initScheduledTasks() {
  await Promise.all([
    createQueue(ARCHIVE_LEADERBOARD_ENTRIES, archiveLeaderboardEntries).upsertJobScheduler(
      `${ARCHIVE_LEADERBOARD_ENTRIES}-scheduler`,
      { pattern: '0 0 0 * * *' },
      { name: `${ARCHIVE_LEADERBOARD_ENTRIES}-job` }
    ),
    createQueue(DELETE_INACTIVE_PLAYERS, deleteInactivePlayers).upsertJobScheduler(
      `${DELETE_INACTIVE_PLAYERS}-scheduler`,
      { pattern: '0 0 0 * * 0' },
      { name: `${DELETE_INACTIVE_PLAYERS}-job` }
    )
  ])
}
