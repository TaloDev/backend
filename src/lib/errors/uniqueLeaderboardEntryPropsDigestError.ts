export class UniqueLeaderboardEntryPropsDigestError extends Error {
  constructor() {
    super('No leaderboard entry with the same props digest found')
    this.name = 'UniqueLeaderboardEntryPropsDigestError'
  }
}
