import archiveLeaderboardEntries from '../tasks/archiveLeaderboardEntries'
import createQueue from '../lib/queues/createQueue'
import deleteInactivePlayers from '../tasks/deleteInactivePlayers'
import cleanupOnlinePlayers from '../tasks/cleanupOnlinePlayers'

const ARCHIVE_LEADERBOARD_ENTRIES = 'archive-leaderboard-entries'
const DELETE_INACTIVE_PLAYERS = 'delete-inactive-players'
const CLEANUP_ONLINE_PLAYERS = 'cleanup-online-players'

export default async function initScheduledTasks() {
  await Promise.all([
    createQueue(ARCHIVE_LEADERBOARD_ENTRIES, archiveLeaderboardEntries).upsertJobScheduler(
      `${ARCHIVE_LEADERBOARD_ENTRIES}-scheduler`,
      { pattern: '0 0 0 * * *' }, // midnight daily
      { name: `${ARCHIVE_LEADERBOARD_ENTRIES}-job` }
    ),
    createQueue(DELETE_INACTIVE_PLAYERS, deleteInactivePlayers).upsertJobScheduler(
      `${DELETE_INACTIVE_PLAYERS}-scheduler`,
      { pattern: '0 0 0 1 * *' }, // midnight on the first day of the month
      { name: `${DELETE_INACTIVE_PLAYERS}-job` }
    ),
    createQueue(CLEANUP_ONLINE_PLAYERS, cleanupOnlinePlayers).upsertJobScheduler(
      `${CLEANUP_ONLINE_PLAYERS}-scheduler`,
      { pattern: '0 0 */4 * * *' }, // every 4 hours
      { name: `${CLEANUP_ONLINE_PLAYERS}-job` }
    )
  ])
}
